import requests
import frappe
from urllib.parse import urlparse


def _master_api_call(path, payload):

    settings = frappe.get_single("Tenant Settings")

    url = f"{settings.master_url}{path}"

    headers = {
        "Authorization": f"token {settings.api_key}:{settings.api_secret}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=30
    )

    response.raise_for_status()
    return response.json().get("message")

def get_tenant_fqdn():
    return urlparse(frappe.utils.get_url()).hostname

@frappe.whitelist()
def install_extension(extension_name):

    fqdn = get_tenant_fqdn()

    return _master_api_call(
        "/api/method/dt_master.api.marketplace.install_extension_for_tenant",
        {
            "extension_name": extension_name,
            "fqdn": fqdn
        }
    )

@frappe.whitelist()
def upgrade_extension(extension_name):

    fqdn = get_tenant_fqdn()

    return _master_api_call(
        "/api/method/dt_master.api.marketplace.upgrade_extension_for_tenant",
        {
            "extension_name": extension_name,
            "fqdn": fqdn
        }
    )

@frappe.whitelist()
def uninstall_extension(extension_name):

    fqdn = get_tenant_fqdn()

    return _master_api_call(
        "/api/method/dt_master.api.marketplace.uninstall_extension_for_tenant",
        {
            "extension_name": extension_name,
            "fqdn": fqdn
        }
    )

@frappe.whitelist()
def publish_install_update(extension, status, action_status, error=None, site=None):

    print(f"Publishing install update: {extension}, {status}, {action_status}, {error}, {site}",f"tenant:{frappe.local.site}")

    frappe.publish_realtime(
        event="extension_install_update",
        message={
            "extension": extension,
            "status": status,
            "action_status": action_status,
            "error": error,
            "site": site
        },
        after_commit=True
    )