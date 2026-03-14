frappe.ui.form.on("Tenant Settings", {
  refresh(frm) {
    if (!frappe.user.has_role("System Manager")) return;

    frm.add_custom_button("Re-sync Capabilities", () => {
      frappe.call({
        method: "dt_tenant.controllers.capability_sync.resync_capabilities",
        freeze: true,
        callback: () => {
          frappe.msgprint("Capabilities re-synced successfully");
        }
      });
    });
  }
});

