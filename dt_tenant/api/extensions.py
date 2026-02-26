import requests
import frappe
from urllib.parse import urlparse


@frappe.whitelist()
def get_marketplace_extensions(tab=None, limit=12, offset=0):

    settings = frappe.get_single("Tenant Settings")

    if not settings.master_url:
        frappe.throw("Master URL not configured")

    fqdn = urlparse(frappe.utils.get_url()).hostname

    response = requests.get(
        f"{settings.master_url.rstrip('/')}/api/method/dt_master.api.extensions.get_extensions",
        headers={
            "Authorization": f"token {settings.api_key}:{settings.api_secret}"
        },
        params={
            "tab": tab,
            "limit": limit,
            "offset": offset,
            "fqdn": fqdn
        },
        timeout=10,
    )

    response.raise_for_status()

    return response.json().get("message")