import frappe
from frappe.utils import nowdate, getdate


PROTECTED_ROLES = {"System Manager", "Tenant Manager"}
DESK_ROLES = {"All", "Desk User", "Tenant Manager"}
ALLOWED_SYSTEM_MODULES = {"Desk", "Dt Tenant"}

def _restrict_system_modules(user):

    modules = frappe.get_all(
        "Module Def",
        pluck="name"
    )

    for module in modules:

        if module in ALLOWED_SYSTEM_MODULES:
            continue

        frappe.db.delete(
            "User Permission",
            {
                "user": user,
                "allow": "Module Def",
                "for_value": module
            }
        )

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

        # Tenant Manager restriction
        if "Tenant Manager" in roles:

            # backup system roles
            frappe.cache().set_value(
                f"tenant_roles_backup:{user}",
                list(roles)
            )

            # keep minimal desk roles
            for role in roles:
                if role not in DESK_ROLES:
                    frappe.db.delete(
                        "Has Role",
                        {"parent": user, "role": role}
                    )

            _restrict_system_modules(user)

            # ---------------------------
            # restrict tenant roles
            # ---------------------------

            allowed_tenant_roles = {"Tenant Manager", "Tenant User"}

            tenant_roles = frappe.get_all(
                "Tenant User Role",
                filters={"parent": user},
                pluck="role"
            )

            for role in tenant_roles:
                if role not in allowed_tenant_roles:
                    frappe.db.delete(
                        "Tenant User Role",
                        {
                            "parent": user,
                            "role": role
                        }
                    )
            # ---------------------------
            # restrict tenant modules
            # ---------------------------

            allowed_modules = {"Desk", "Dt Tenant"}

            modules = frappe.get_all(
                "Tenant Allowed Module",
                filters={"parent": user},
                pluck="module"
            )

            for module in modules:
                if module not in allowed_modules:
                    frappe.db.delete(
                        "Tenant Allowed Module",
                        {
                            "parent": user,
                            "module": module
                        }
                    )

            continue

        # all other users disabled
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

    if status in ("Unpaid", "Completed"):
        _disable_non_admin_users()
        _disable_auto_sync()
        return "restricted"

    if status == "Grace Period":
        # still allow access but show banner in UI
        _enable_auto_sync()
        _enable_all_users(caps)
        return "grace"

    if status in ("Active", "Trialing", "Cancelled"):
        _enable_auto_sync()
        _enable_all_users(caps)
        return "active"

    return "unknown"
