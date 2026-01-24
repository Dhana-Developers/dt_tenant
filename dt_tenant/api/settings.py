import frappe

@frappe.whitelist()
def configure(**kwargs):
    settings = frappe.get_single("Tenant Settings")
    for k, v in kwargs.items():
        if hasattr(settings, k):
            setattr(settings, k, v)
    settings.save(ignore_permissions=True)
