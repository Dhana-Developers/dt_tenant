import frappe
from frappe.utils import nowdate, getdate


PROTECTED_ROLES = {"System Manager", "Tenant Manager"}
DESK_ROLES = {"All", "Desk User", "Tenant Manager"}

def _disable_non_admin_users():
    users = frappe.get_all(
        "User",
        filters={"enabled": 1, "name": ["!=", "Administrator"]},
        pluck="name"
    )

    for user in users:

        roles = set(frappe.get_roles(user))

        # System Manager untouched
        if "System Manager" in roles:
            continue

        # Tenant Manager restriction (not disabled)
        if "Tenant Manager" in roles:

            # Save current roles for restoration
            frappe.cache().set_value(
                f"tenant_roles_backup:{user}",
                list(roles)
            )

            # Remove roles except minimal desk roles
            for role in roles:
                if role not in DESK_ROLES:
                    frappe.db.delete(
                        "Has Role",
                        {
                            "parent": user,
                            "role": role
                        }
                    )

            continue

        # All other users disabled
        frappe.db.set_value("User", user, "enabled", 0)


def _enable_all_users(caps):

    allowed_roles = set(caps.get("allowed_roles", []))

    users = frappe.get_all(
        "User",
        filters={"enabled": 0},
        pluck="name"
    )

    for user in users:

        if user == "Administrator":
            continue

        roles = set(frappe.get_roles(user))

        # System Manager untouched
        if "System Manager" in roles:
            continue

        frappe.db.set_value("User", user, "enabled", 1)

    # Restore tenant manager roles
    tenant_managers = frappe.get_all(
        "Has Role",
        filters={"role": "Tenant Manager"},
        pluck="parent"
    )

    for user in tenant_managers:

        saved_roles = frappe.cache().get_value(
            f"tenant_roles_backup:{user}"
        )

        if not saved_roles:
            saved_roles=allowed_roles

        for role in saved_roles:

            if role not in allowed_roles:
                continue

            if not frappe.db.exists(
                "Has Role",
                {
                    "parent": user,
                    "role": role
                }
            ):
                frappe.get_doc({
                    "doctype": "Has Role",
                    "parent": user,
                    "parenttype": "User",
                    "parentfield": "roles",
                    "role": role
                }).insert(ignore_permissions=True)

        frappe.cache().delete_value(f"tenant_roles_backup:{user}")


def _disable_auto_sync():
    settings = frappe.get_single("Tenant Settings")

    if settings.enable_capability_sync:
        settings.enable_capability_sync = 0
        settings.save(ignore_permissions=True)


def _enable_auto_sync():
    settings = frappe.get_single("Tenant Settings")

    if not settings.enable_capability_sync:
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
    _enable_all_users(caps)
    return "active"
