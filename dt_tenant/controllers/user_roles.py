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
