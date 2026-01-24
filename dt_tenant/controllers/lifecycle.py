import frappe
from frappe.utils import nowdate, getdate


def _disable_non_admin_users():
    users = frappe.get_all(
        "User",
        filters={"enabled": 1, "name": ["!=", "Administrator"]},
        pluck="name"
    )
    for u in users:
        user = frappe.get_doc("User", u)
        user.enabled = 0
        user.save(ignore_permissions=True)

def _enable_all_users():
    users = frappe.get_all("User", filters={"enabled": 0}, pluck="name")
    for u in users:
        if u == "Administrator":
            continue
        user = frappe.get_doc("User", u)
        user.enabled = 1
        user.save(ignore_permissions=True)

def _disable_auto_sync():
    settings = frappe.get_single("Tenant Settings")
    settings.enable_capability_sync = 0
    settings.save(ignore_permissions=True)

def _enable_auto_sync():
    settings = frappe.get_single("Tenant Settings")
    settings.enable_capability_sync = 1
    settings.save(ignore_permissions=True)


def enforce_lifecycle(caps):
    status = caps.get("subscription_status")
    trial_end = caps.get("trial_period_end")
    end_date = caps.get("end_date")

    today = getdate(nowdate())

    if status == "Trialing" and trial_end and today > getdate(trial_end):
        _disable_non_admin_users()
        _disable_auto_sync()
        return "trial_expired"

    if end_date and today > getdate(end_date):
        _disable_non_admin_users()
        _disable_auto_sync()
        return "subscription_expired"

    # Active / valid trial
    _enable_auto_sync()
    _enable_all_users()
    return "active"
