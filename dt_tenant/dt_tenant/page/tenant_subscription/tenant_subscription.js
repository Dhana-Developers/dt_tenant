frappe.pages['tenant_subscription'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Tenant Subscription',
		single_column: true
	});
}