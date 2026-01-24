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


