import frappe
from .capabilities import get_capabilities


def assign_roles(doc, method=None,save=True):

    if doc.name == "Administrator":
        return

    try:
        caps = get_capabilities()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Capability Sync Failed")
        return

    allowed_roles = set(caps.get("allowed_roles", []))
    allowed_modules = set(caps.get("allowed_modules", []))

    profile_roles = set()
    profile_modules = set()

    # --------------------------------
    # 1️⃣ Load roles/modules from profile
    # --------------------------------
    profile_name = doc.custom_tenant_role_profiles

    if profile_name:
        profile = frappe.get_doc("Tenant Role Profile", profile_name)

        for row in profile.profile:

            if row.role:
                role_doc = frappe.get_doc("Tenant Roles", row.role)
                profile_roles.add(role_doc.role)

            if row.module:
                module_doc = frappe.get_doc("Tenant Modules", row.module)
                profile_modules.add(module_doc.module)

    # --------------------------------
    # 2️⃣ Load roles directly assigned to user
    # --------------------------------
    user_roles = set()

    for row in doc.custom_tenant_roles or []:
        role_doc = frappe.get_doc("Tenant Roles", row.role)
        user_roles.add(role_doc.role)

    # --------------------------------
    # 3️⃣ Load modules directly assigned to user
    # --------------------------------
    user_modules = set()

    for row in doc.custom_tenant_allowed_modules or []:
        module_doc = frappe.get_doc("Tenant Modules", row.module)
        user_modules.add(module_doc.module)

    # --------------------------------
    # 4️⃣ Combine sources
    # --------------------------------
    final_roles = (profile_roles | user_roles) & allowed_roles
    final_modules = (profile_modules | user_modules) & allowed_modules

    # --------------------------------
    # 5️⃣ Apply system roles
    # --------------------------------
    doc.set("roles", [])

    for role in final_roles:
        doc.append("roles", {"role": role})

    # --------------------------------
    # 6️⃣ Restrict modules
    # --------------------------------
    all_modules = set(
        frappe.get_all("Module Def", pluck="module_name")
    )

    blocked_modules = all_modules - final_modules

    doc.set("block_modules", [])

    for module in blocked_modules:
        doc.append("block_modules", {"module": module})

    # prevent recursion
    if not getattr(doc, "_tenant_roles_synced", False) and save:
        doc._tenant_roles_synced = True
        doc.save(ignore_permissions=True)

def sync_tenant_roles_to_system(doc, method):
    # Collect system roles derived from tenant roles
    system_roles = set()

    for row in doc.get("custom_tenant_roles", []):
        tenant_role_name = row.role  # adjust to your fieldname

        tenant_role = frappe.get_doc("Tenant Roles", tenant_role_name)

        if not tenant_role.enabled:
            frappe.throw(f"Tenant Role {tenant_role_name} is not enabled")

        system_roles.add(tenant_role.role)

    # Always keep required base roles
    system_roles |= {"All", "Desk User"}

    # Clear existing roles
    doc.set("roles", [])

    # Inject resolved system roles
    for role in system_roles:
        doc.append("roles", {"role": role})

def sync_tenant_modules_to_system(doc, method):

    # -------------------------
    # 1. Collect user-selected modules
    # -------------------------
    selected_modules = set()

    for row in doc.get("custom_tenant_allowed_modules", []):
        module_name = row.module  # adjust if fieldname differs
        selected_modules.add(module_name)

    # -------------------------
    # 2. Validate against tenant overlay
    # -------------------------
    allowed_overlay_modules = set(
        frappe.get_all(
            "Tenant Modules",
            filters={"enabled": 1},
            pluck="module"
        )
    )

    for module in selected_modules:
        if module not in allowed_overlay_modules:
            frappe.throw(f"Module {module} is not enabled for this tenant")

    # Optional: always allow base modules
    ALWAYS_ALLOW_MODULES = {"Core", "Desk"}
    selected_modules |= ALWAYS_ALLOW_MODULES

    # -------------------------
    # 3. Compute blocked modules
    # -------------------------
    all_modules = set(
        frappe.get_all(
            "Module Def",
            pluck="module_name"
        )
    )

    blocked_modules = all_modules - selected_modules

    # -------------------------
    # 4. Replace block_modules table
    # -------------------------
    doc.set("block_modules", [])

    for module in blocked_modules:
        doc.append("block_modules", {"module": module})

def sync_tenant_permissions(doc, method):

    # System Manager bypass
    if "System Manager" in frappe.get_roles(frappe.session.user):
        assign_roles(doc, method,False)
        return

    caps = get_capabilities()
    status = caps.get("subscription_status")

    # Block user updates if subscription unpaid
    if status == "Unpaid":
        frappe.throw("Subscription payment required before modifying users")


    assign_roles(doc, method,False)
