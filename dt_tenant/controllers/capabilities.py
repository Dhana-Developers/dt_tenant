from urllib.parse import urlparse
import requests
import frappe

class CapabilitySyncError(Exception):
    pass

def fetch_capabilities():
    settings = frappe.get_single("Tenant Settings")

    if not settings.master_url:
        raise CapabilitySyncError("Master URL not configured")

    api_secret = settings.api_secret
    if not settings.api_key or not api_secret:
        raise CapabilitySyncError("Master API credentials not configured")

    fqdn = urlparse(frappe.utils.get_url()).hostname

    try:
        response = requests.post(
            f"{settings.master_url.rstrip('/')}/api/method/dt_master.api.tenant_capabilities.get_tenant_capabilities",
            headers={
                "Authorization": f"token {settings.api_key}:{api_secret}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"fqdn": fqdn},
            timeout=5,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise CapabilitySyncError(f"Master unreachable: {str(e)}")

    data = response.json().get("message")
    if not data:
        raise CapabilitySyncError("Invalid response from master")

    return data

def get_capabilities():

    caps = getattr(frappe.local, "tenant_capabilities", None)

    if caps:
        return caps

    snapshot = frappe.db.get_single_value(
        "Tenant Settings",
        "capability_snapshot"
    )

    if snapshot:
        return frappe.parse_json(snapshot)
    else:
        return fetch_capabilities()
