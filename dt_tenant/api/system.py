# dt_tenant/api/system.py
import frappe

@frappe.whitelist()
def is_app_installed(app_name: str):
    # Do NOT block on System Manager during provisioning
    # Just ensure we are not running as Guest
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted")

    return {
        "installed": app_name in frappe.get_installed_apps()
    }

@frappe.whitelist()
def has_active_system_manager():
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted")

    users = frappe.get_all(
        "User",
        filters={"enabled": 1},
        pluck="name"
    )

    for user in users:
        if user == "Administrator":
            return True

        roles = frappe.get_roles(user)
        if "System Manager" in roles:
            return True

    return False
