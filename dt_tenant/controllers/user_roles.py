import frappe
from .capabilities import fetch_capabilities

def assign_roles(doc, method=None):

    if doc.name == "Administrator":
        return

    try:
        caps = fetch_capabilities()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Capability Sync Failed")
        return

    allowed_roles = caps.get("allowed_roles", [])
    allowed_modules = caps.get("allowed_modules", [])

    # -----------------
    # Assign roles
    # -----------------
    doc.set("roles", [])
    for role in allowed_roles:
        doc.append("roles", {"role": role})

    # -----------------
    # Restrict modules
    # -----------------
    all_modules = frappe.get_all("Module Def", pluck="module_name")

    blocked = set(all_modules) - set(allowed_modules)

    doc.set("block_modules", [])
    for module in blocked:
        doc.append("block_modules", {"module": module})

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
    sync_tenant_roles_to_system(doc,method)
    sync_tenant_modules_to_system(doc,method)
