import frappe
from ..controllers.capabilities import get_capabilities


def enforce_subscription():

    request = frappe.local.request
    path = (request.path or "").lower()

    # Allow all public / login / static routes
    if path.startswith((
        "/login",
        "/api/method/login",
        "/api/method/logout",
        "/assets/",
        "/files/",
        "/website",
    )):
        return

    # Only enforce inside Desk
    if not path.startswith("/app"):
        return

    # If user not logged in yet, don't enforce
    if frappe.session.user in ("Guest", None):
        return

    # System Managers bypass
    if "System Manager" in frappe.get_roles(frappe.session.user):
        return

    caps = get_capabilities()
    status = caps.get("subscription_status")

    if status != "Unpaid":
        return

    # Allow subscription page
    if path.startswith("/app/tenant-subscription"):
        return

    frappe.throw("Subscription payment required")