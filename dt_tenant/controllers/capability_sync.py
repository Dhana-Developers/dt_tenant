import frappe

from dt_tenant.controllers.lifecycle import enforce_lifecycle
from dt_tenant.controllers.audit import log_capability_sync
from dt_tenant.controllers.capabilities import fetch_capabilities, CapabilitySyncError

ALWAYS_KEEP_ROLES = {
    "Employee",
}

ALWAYS_ALLOW_MODULES = {
    "Core",
    "Desk",
    "Custom",
}


def apply_capabilities_to_user(user_name, allowed_roles, allowed_modules):
    user = frappe.get_doc("User", user_name)

    allowed_roles = set(allowed_roles) | ALWAYS_KEEP_ROLES
    allowed_modules = set(allowed_modules) | ALWAYS_ALLOW_MODULES

    # ---------- ROLES (PRUNE + APPLY) ----------
    user.set("roles", [])

    for role in allowed_roles:
        user.append("roles", {"role": role})

    # ---------- MODULES (PRUNE + APPLY) ----------
    all_modules = set(
        frappe.get_all("Module Def", pluck="module_name")
    )

    blocked_modules = all_modules - allowed_modules

    user.set("block_modules", [])
    for module in blocked_modules:
        user.append("block_modules", {"module": module})

    user.save(ignore_permissions=True)

def sync_tenant_roles(allowed_roles, source_profile=None):
    allowed_set = set(allowed_roles)

    existing_docs = frappe.get_all(
        "Tenant Roles",
        fields=["name", "role"]
    )

    role_map = {d.role: d.name for d in existing_docs}
    existing_roles = set(role_map.keys())

    roles_to_delete = existing_roles - allowed_set

    for role in roles_to_delete:
        tenant_role_name = role_map[role]

        # 🔥 1️⃣ Remove User child references
        frappe.db.delete(
            "Tenant User Role",
            {"role": tenant_role_name}
        )

        # 🔥 2️⃣ Remove Role Profile references
        frappe.db.delete(
            "Tenant User Role Profile",
            {"role": tenant_role_name}
        )

        # 🔥 3️⃣ Delete overlay role
        frappe.delete_doc(
            "Tenant Roles",
            tenant_role_name,
            ignore_permissions=True
        )

    # Insert new roles
    for role in allowed_set - existing_roles:
        frappe.get_doc({
            "doctype": "Tenant Roles",
            "role": role,
            "enabled": 1,
            "source_profile": source_profile
        }).insert(ignore_permissions=True)

    # Update existing roles
    for role in allowed_set & existing_roles:
        doc = frappe.get_doc("Tenant Roles", role_map[role])
        doc.enabled = 1
        doc.source_profile = source_profile
        doc.save(ignore_permissions=True)

def sync_tenant_modules(allowed_modules, source_profile=None):
    allowed_set = set(allowed_modules)

    existing_modules = set(
        frappe.get_all("Tenant Modules", pluck="name")
    )

    modules_to_delete = existing_modules - allowed_set

    # -----------------------------------
    # 1️⃣ HARD DELETE REMOVED MODULES
    # -----------------------------------
    for module in modules_to_delete:
        # 🔥 Remove from User child table
        frappe.db.delete(
            "Tenant Allowed Module",
            {"module": module}
        )

        # 🔥 Remove from Role Profile child table
        frappe.db.delete(
            "Tenant User Role Profile",
            {"module": module}
        )

        # 🔥 Delete overlay module itself
        frappe.delete_doc(
            "Tenant Modules",
            module,
            ignore_permissions=True
        )

    # -----------------------------------
    # 2️⃣ INSERT NEW MODULES
    # -----------------------------------
    for module in allowed_set - existing_modules:
        frappe.get_doc({
            "doctype": "Tenant Modules",
            "module": module,
            "enabled": 1,
            "source_profile": source_profile
        }).insert(ignore_permissions=True)

    # -----------------------------------
    # 3️⃣ UPDATE SOURCE PROFILE FOR EXISTING
    # -----------------------------------
    for module in allowed_set & existing_modules:
        doc = frappe.get_doc("Tenant Modules", module)
        doc.enabled = 1
        doc.source_profile = source_profile
        doc.save(ignore_permissions=True)

@frappe.whitelist()
def resync_capabilities():
    try:
        caps = fetch_capabilities()
    except CapabilitySyncError as e:
        log_capability_sync(
            status="Failed",
            error_message=str(e)
        )
        frappe.throw(str(e))

    # -------------------------------
    # PHASE 2 · STEP 2: LIFECYCLE GATE
    # -------------------------------
    lifecycle_state = enforce_lifecycle(caps)

    if lifecycle_state != "active":
        log_capability_sync(
            status="Failed",
            error_message=f"Lifecycle state blocked sync: {lifecycle_state}"
        )
        return {
            "status": lifecycle_state,
            "message": "Tenant not in active subscription state"
        }

    # -------------------------------
    # EXISTING LOGIC (UNCHANGED)
    # -------------------------------
    allowed_roles = caps.get("allowed_roles", [])
    allowed_modules = caps.get("allowed_modules", [])

    #🔹 PHASE 2 — CACHE SNAPSHOT
    sync_tenant_roles(allowed_roles, source_profile=caps.get("capability_profile"))
    sync_tenant_modules(allowed_modules, source_profile=caps.get("capability_profile"))

    if not allowed_roles:
        log_capability_sync(
            status="Failed",
            error_message="No roles returned from master"
        )
        frappe.throw("No roles returned from master")

    users = frappe.get_all(
        "User",
        filters={"user_type": "System User", "enabled": 1},
        pluck="name"
    )

    count = 0
    for user in users:
        if user == "Administrator":
            continue

        apply_capabilities_to_user(
            user,
            allowed_roles,
            allowed_modules
        )
        count += 1

    # -------------------------------
    # SUCCESS LOG (UNCHANGED)
    # -------------------------------
    log_capability_sync(
        status="Success",
        users_updated=count
    )

    settings = frappe.get_single("Tenant Settings")
    settings.last_sync_at = frappe.utils.now()
    settings.save(ignore_permissions=True)

    return {
        "status": "ok",
        "users_updated": count,
    }


