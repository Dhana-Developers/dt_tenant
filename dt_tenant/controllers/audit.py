import frappe

def log_capability_sync(status, users_updated=0, error_message=None):
    log = frappe.new_doc("Capability Sync Log")
    log.triggered_by = frappe.session.user
    log.status = status
    log.users_updated = users_updated
    log.error_message = error_message
    log.synced_at = frappe.utils.now()
    log.insert(ignore_permissions=True)
