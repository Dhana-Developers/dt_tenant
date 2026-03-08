import frappe
import requests
from urllib.parse import urlparse

from dt_tenant.controllers.capabilities import fetch_capabilities
from dt_tenant.controllers.capability_sync import resync_capabilities

@frappe.whitelist()
def get_capabilities():
    return fetch_capabilities()


def _master_request(method, payload=None):

    settings = frappe.get_single("Tenant Settings")

    if not settings.master_url:
        frappe.throw("Master URL not configured")

    url = f"{settings.master_url.rstrip('/')}/api/method/{method}"

    headers = {
        "Authorization": f"token {settings.api_key}:{settings.api_secret}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    fqdn = urlparse(frappe.utils.get_url()).hostname

    data = payload or {}
    data["fqdn"] = fqdn

    response = requests.post(url, headers=headers, data=data, timeout=5)

    response.raise_for_status()

    result = response.json().get("message")

    if result is None:
        frappe.throw("Invalid response from master")

    return result


@frappe.whitelist()
def get_available_plans(limit=12, offset=0):
    return _master_request(
        "dt_master.api.subscription.get_available_plans",
        {"limit":limit,"offset":offset}
    )

@frappe.whitelist()
def get_billing_history(limit=12, offset=0):
    return _master_request(
        "dt_master.api.subscription.get_billing_history",
        {"limit":limit,"offset":offset}
    )

@frappe.whitelist()
def download_invoice(invoice_name,prt_format):

    settings = frappe.get_single("Tenant Settings")

    if not settings.master_url:
        frappe.throw("Master URL not configured")

    if not settings.api_key or not settings.api_secret:
        frappe.throw("Master API credentials not configured")

    try:
        response = requests.get(
            f"{settings.master_url.rstrip('/')}/api/method/dt_master.api.billing.download_invoice_pdf",
            headers={
                "Authorization": f"token {settings.api_key}:{settings.api_secret}"
            },
            params={
                "invoice_name": invoice_name,
                "prt_format": prt_format
            },
            timeout=10,
            stream=True
        )

        response.raise_for_status()

    except requests.exceptions.RequestException as e:
        frappe.throw(f"Unable to download invoice: {str(e)}")

    frappe.local.response.filename = f"{invoice_name}.pdf"
    frappe.local.response.filecontent = response.content
    frappe.local.response.type = "download"

@frappe.whitelist()
def change_subscription_plan(plan_name):

    result = _master_request(
        "dt_master.api.subscription.change_subscription_plan",
        {"plan_name": plan_name}
    )

    resync_capabilities()

    return result