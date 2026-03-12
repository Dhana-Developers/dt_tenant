import frappe
from frappe.desk.desktop import get_desktop_page
from ...controllers.capabilities import get_capabilities


@frappe.whitelist()
def filter_workspace(page=None):

    # Get original workspace data
    workspace = get_desktop_page(page)

    if not workspace:
        return workspace

    # Only apply to Tenant workspace
    if workspace.get("title") != "Tenant":
        return workspace

    # System Manager bypass
    if "System Manager" in frappe.get_roles(frappe.session.user):
        return workspace

    caps = get_capabilities()
    status = caps.get("subscription_status")

    if status == "Unpaid":

        workspace["shortcuts"] = [
            s for s in workspace.get("shortcuts", [])
            if s.get("label") == "Subscription"
        ]

        workspace["content"] = [
            block for block in workspace.get("content", [])
            if block.get("data", {}).get("shortcut_name") == "Subscription"
        ]

    return workspace
