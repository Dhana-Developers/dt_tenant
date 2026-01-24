import frappe
from dt_tenant.controllers.capability_sync import resync_capabilities
from dt_tenant.controllers.capabilities import CapabilitySyncError

FAILURE_COOLDOWN_MINUTES = 60

def _recent_failure_within(settings, minutes):
    last_log = frappe.get_all(
        "Capability Sync Log",
        filters={"status": "Failed"},
        fields=["synced_at"],
        order_by="synced_at desc",
        limit=1,
    )

    if not last_log:
        return False

    last_failed_at = last_log[0].synced_at
    return frappe.utils.time_diff_in_minutes(
        frappe.utils.now(), last_failed_at
    ) < minutes


def run_scheduled_sync():
    settings = frappe.get_single("Tenant Settings")

    # 1. Explicit opt-in
    if not settings.enable_capability_sync:
        return

    # 2. Credentials must exist
    if not settings.api_key or not settings.api_secret:
        return

    # 3. Cooldown after failure
    if _recent_failure_within(settings, FAILURE_COOLDOWN_MINUTES):
        return

    try:
        resync_capabilities()
    except CapabilitySyncError:
        # resync_capabilities already logs failure
        pass
