import requests
import frappe
from urllib.parse import urlparse


def normalize_version(version):
    if not version:
        return [0, 0, 0]

    # Remove anything after first hyphen (dev, beta, rc, etc.)
    clean = version.split("-")[0]

    parts = clean.split(".")

    normalized = []
    for part in parts:
        try:
            normalized.append(int(part))
        except ValueError:
            normalized.append(0)

    return normalized

@frappe.whitelist()
def get_marketplace_extensions(tab=None, limit=12, offset=0):

    settings = frappe.get_single("Tenant Settings")

    if not settings.master_url:
        frappe.throw("Master URL not configured")

    fqdn = urlparse(frappe.utils.get_url()).hostname

    frappe_version = frappe.__version__
    normalized_frappe_version=normalize_version(frappe_version)
    frappe_major = normalized_frappe_version[0]
    frappe_minor = normalized_frappe_version[1]
    frappe_patch = normalized_frappe_version[2]

    response = requests.get(
        f"{settings.master_url.rstrip('/')}/api/method/dt_master.api.extensions.get_extensions",
        headers={
            "Authorization": f"token {settings.api_key}:{settings.api_secret}"
        },
        params={
            "tab": tab,
            "limit": limit,
            "offset": offset,
            "fqdn": fqdn,
            "frappe_major": frappe_major,
            "frappe_minor": frappe_minor,
            "frappe_patch": frappe_patch
        },
        timeout=10,
    )

    response.raise_for_status()

    return response.json().get("message")