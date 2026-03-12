
const SUB_TABS = [
    {
        key: "current_plan",
        label: "Current Plan",
        active: true,
        state: { initialized: false, data: null }
    },
    {
        key: "available_plans",
        label: "Available Plans",
        state: {
            initialized: false,
            data: [],
            limit: 12,
            offset: 0,
            hasMore: true,
            isLoading: false
        }
    },
    {
        key: "billing",
        label: "Billing",
        state: {
            initialized: false,
            data: [],
            limit: 12,
            offset: 0,
            hasMore: true,
            isLoading: false
        }
    }
];

const SUBSCRIPTION_STATUS = {

    Trialing: {
        label: "Trial",
        allowAccess: true,
        showBanner: false
    },

    Active: {
        label: "Active",
        allowAccess: true,
        showBanner: false
    },

    "Grace Period": {
        label: "Payment Overdue",
        allowAccess: true,
        showBanner: true
    },

    Unpaid: {
        label: "Unpaid",
        allowAccess: false,
        showBanner: true
    },

    Cancelled: {
        label: "Cancelled",
        allowAccess: true,
        showBanner: false
    },

    Completed: {
        label: "Completed",
        allowAccess: false,
        showBanner: false
    }

};

const PLAN_CHANGE_ALLOWED = ["Unpaid", "Grace Period"];

let CURRENT_SUBSCRIPTION = {
    plan: null,
    status: null
};

function render_empty_state(target, message){

    $(target).html(`
        <div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-text">${message}</div>
        </div>
    `);

}

function render_subscription_tab(tabKey) {

    const tab = SUB_TABS.find(t => t.key === tabKey);
    if (!tab) return;

    $("#subscription-tab-content").html(`
        <div class="subscription-section">
            <div id="subscription-${tab.key}"></div>
        </div>
    `);

    /* ---------- CURRENT PLAN ---------- */

    if (tabKey === "current_plan") {

        if (tab.state.initialized) {
            render_subscription_content("current_plan", tab.state.data);
        } else {
            $("#subscription-current_plan").html("Loading...");
            load_current_plan(tab);
        }

        return;
    }

    /* ---------- AVAILABLE PLANS ---------- */

    if (tabKey === "available_plans") {

        /* render cached plans immediately */
        if (tab.state.data.length) {
            render_available_plans(tab.state.data, tab.state);
        } else {
            $("#subscription-available_plans").html("Loading...");
												if ( !tab.state.isLoading){
															render_empty_state("#subscription-available_plans","No plans available");
												}
        }

        /* fetch only once initially */
        if (!tab.state.initialized) {
            load_available_plans(tab);
        }

        return;
    }

    /* ---------- BILLING ---------- */

    if (tabKey === "billing") {

        if (tab.state.data.length) {
            render_billing(tab.state.data);
        } else {
            $("#subscription-billing").html("Loading...");
												if ( !tab.state.isLoading){
															render_empty_state("#subscription-billing","No billing history");
												}
        }

        if (!tab.state.initialized) {
            load_billing(tab);
        }

        return;
    }
}

function load_current_plan(tab) {

    frappe.call({
        method: "dt_tenant.api.tenant_subscription.get_capabilities",
        callback: function(r){

            if(!r.message){
                $("#subscription-current_plan").html("Unable to load subscription");
                return;
            }

			CURRENT_SUBSCRIPTION.plan = r.message.subscription_plan;
            CURRENT_SUBSCRIPTION.status = r.message.subscription_status;

            tab.state.data = r.message;
            tab.state.initialized = true;

            render_subscription_content("current_plan", r.message);

            /* fetch billing to evaluate banner */
            frappe.call({
                method:"dt_tenant.api.tenant_subscription.get_billing_history",
                args:{ limit: 5, offset: 0 },
                callback:function(res){
                    render_subscription_banner(r.message, res.message || []);
                }
            });

        }
    });

}

function get_status_badge(status){

    const colors = {
        Trialing: "orange",
        Active: "green",
        "Grace Period": "orange",
        Unpaid: "red",
        Cancelled: "gray",
        Completed: "gray"
    };

    return `
        <span class="status-badge status-${colors[status] || "gray"}">
            ${status}
        </span>
    `;
}

function render_subscription_content(tabKey, data) {

    if (tabKey !== "current_plan") return;

    const machine = data.machine_properties || {};

    $("#subscription-current_plan").html(`

        <div class="plan-card">

            <h3>${data.subscription_plan}</h3>

            <div class="text-muted">
                ${get_status_badge(data.subscription_status)}
            </div>

            <div class="plan-meta mt-3">
                <div><b>Trial Ends:</b> ${data.trial_period_end || "N/A"}</div>
                <div><b>Expires:</b> ${data.end_date || "N/A"}</div>
                <div><b>Capability Profile:</b> ${data.capability_profile}</div>
            </div>

            <hr>

            <h5>Allowed Modules</h5>
            <div class="meta-list">
                ${(data.allowed_modules || []).join(", ") || "None"}
            </div>

            <h5 class="mt-3">Allowed Roles</h5>
            <div class="meta-list">
                ${(data.allowed_roles || []).join(", ") || "None"}
            </div>

            <hr>

            <h5>Compute</h5>
            <div class="plan-limits">
                <div>CPU Cores <b>${machine.cpu_cores || "-"}</b></div>
                <div>CPU Quota <b>${machine.cpu_quota_percent || "-"}%</b></div>
                <div>CPU Shares <b>${machine.cpu_shares || "-"}</b></div>
            </div>

            <h5 class="mt-3">Memory</h5>
            <div class="plan-limits">
                <div>RAM <b>${machine.ram_gb || "-"} GB</b></div>
                <div>Reserved RAM <b>${machine.ram_reservation_gb || "-"} GB</b></div>
                <div>Swap Limit <b>${machine.swap_limit_gb || "-"} GB</b></div>
            </div>

            <h5 class="mt-3">Storage</h5>
            <div class="plan-limits">
                <div>Disk <b>${machine.storage_gb || "-"} GB</b></div>
                <div>Database <b>${machine.database_storage_gb || "-"} GB</b></div>
                <div>Backup <b>${machine.backup_storage_gb || "-"} GB</b></div>
            </div>

            <h5 class="mt-3">Workers</h5>
            <div class="plan-limits">
                <div>Web Workers <b>${machine.web_workers || "-"}</b></div>
                <div>Background Workers <b>${machine.background_workers || "-"}</b></div>
                <div>Scheduler Workers <b>${machine.scheduler_workers || "-"}</b></div>
            </div>

            <h5 class="mt-3">Database Safety</h5>
            <div class="plan-limits">
                <div>Max Connections <b>${machine.max_connections || "-"}</b></div>
                <div>Query Timeout <b>${machine.query_timeout_seconds || "-"}s</b></div>
                <div>Max Query Memory <b>${machine.max_query_memory_mb || "-"} MB</b></div>
            </div>

            <h5 class="mt-3">Protection Limits</h5>
            <div class="plan-limits">
                <div>Max Users <b>${machine.max_users || "-"}</b></div>
                <div>API / min <b>${machine.max_api_requests_per_minute || "-"}</b></div>
                <div>Background Jobs <b>${machine.max_background_jobs || "-"}</b></div>
                <div>Upload Size <b>${machine.max_file_upload_mb || "-"} MB</b></div>
            </div>

            <h5 class="mt-3">Infrastructure</h5>
            <div class="plan-limits">
                <div>Deployment <b>${machine.deployment_type || "-"}</b></div>
                <div>Container Image <b>${machine.container_image || "-"}</b></div>
                <div>Node Selector <b>${machine.node_selector || "-"}</b></div>
            </div>

        </div>
    `);
}

function render_plan_details(data){

    const plan = data.plan || {};
    const profile = data.capability_profile || {};
    const machine = data.machine_constraints || {};

    let modules = (data.allowed_modules || []).join(", ") || "None";
    let roles = (data.allowed_roles || []).join(", ") || "None";

    const html = `

        <div class="plan-card">

            <h3>${plan.plan_name}</h3>

            <div class="plan-price">
                ${plan.currency} ${plan.cost || 0}
            </div>

            <div class="text-muted">
                Billing: ${plan.billing_interval} × ${plan.billing_interval_count}
            </div>

            <hr>

            <h5>Capability Profile</h5>
            <div class="meta-list">${profile.description || "No description"}</div>

            <h6 class="mt-3">Modules</h6>
            <div class="meta-list">${modules}</div>

            <h6 class="mt-3">Roles</h6>
            <div class="meta-list">${roles}</div>

            <hr>

            <h5>Compute</h5>
            <div class="plan-limits">
                <div>CPU Cores <b>${machine.cpu_cores || "-"}</b></div>
                <div>CPU Quota <b>${machine.cpu_quota_percent || "-"}%</b></div>
                <div>CPU Shares <b>${machine.cpu_shares || "-"}</b></div>
            </div>

            <h5 class="mt-3">Memory</h5>
            <div class="plan-limits">
                <div>RAM <b>${machine.ram_gb || "-"} GB</b></div>
                <div>Reserved RAM <b>${machine.ram_reservation_gb || "-"} GB</b></div>
                <div>Swap Limit <b>${machine.swap_limit_gb || "-"} GB</b></div>
            </div>

            <h5 class="mt-3">Storage</h5>
            <div class="plan-limits">
                <div>Disk <b>${machine.storage_gb || "-"} GB</b></div>
                <div>Database <b>${machine.database_storage_gb || "-"} GB</b></div>
                <div>Backup <b>${machine.backup_storage_gb || "-"} GB</b></div>
            </div>

        </div>
    `;

    const dialog = new frappe.ui.Dialog({
        title: plan.plan_name,
        size: "large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "plan_details"
            }
        ]
    });

    dialog.fields_dict.plan_details.$wrapper.html(html);

    dialog.show();
}

function bind_plan_events(plans){

    $(".plan-option").on("click", function(e){

        if($(e.target).closest(".upgrade-plan").length){
            return;
        }

        const index = $(this).data("index");
        const data = plans[index];

        render_plan_details(data);
    });

}

function render_available_plans(plans, state){

				if(!plans.length){
        render_empty_state("#subscription-available_plans","No plans available");
        return;
    }

    let html = `<div class="plan-grid">`;

    plans.forEach((row, index) => {

        const plan = row.plan || {};
        const machine = row.machine_constraints || {};
        const profile = row.capability_profile || {};
        const canChangePlan = PLAN_CHANGE_ALLOWED.includes(CURRENT_SUBSCRIPTION.status);


        html += `
            <div class="plan-option"
                 data-index="${index}">

                <h4>${plan.plan_name}</h4>

                <div class="plan-price">
                    ${plan.currency} ${plan.cost || 0}
                </div>

                <div class="text-muted">
                    ${plan.billing_interval || ""} × ${plan.billing_interval_count || 1}
                </div>

                <div class="plan-summary">

                    <div>CPU <b>${machine.cpu_cores || "-"}</b></div>
                    <div>RAM <b>${machine.ram_gb || "-"} GB</b></div>
                    <div>Storage <b>${machine.storage_gb || "-"} GB</b></div>
                    <div>Users <b>${machine.max_users || "-"}</b></div>

                </div>

                <p class="text-muted">
                    ${profile.description || ""}
                </p>

                ${
                    plan.name === CURRENT_SUBSCRIPTION.plan
                    ? `<span class="plan-current">Current Plan</span>`
                    : canChangePlan
                        ? `<button class="btn btn-primary btn-sm upgrade-plan"
                                data-plan="${plan.name}">
                                Choose Plan
                        </button>`
                        : `<span class="text-muted small">Plan locked during active cycle</span>`
                }

            </div>
        `;
    });

    html += `</div>`;
				if(state?.hasMore){
								html += `
												<div class="text-center mt-3">
																<button class="btn btn-secondary load-more-plans">
																				Load More
																</button>
												</div>
								`;
				}

    $("#subscription-available_plans").html(html);

    bind_plan_events(plans);
}

function load_available_plans(tab){

    const state = tab.state;

    if(state.isLoading) return;

    state.isLoading = true;

    frappe.call({
        method:"dt_tenant.api.tenant_subscription.get_available_plans",
        args:{
            limit: state.limit,
            offset: state.offset
        },
        callback:function(r){

            state.isLoading = false;

            const rows = r.message || [];

												if(!rows.length){

																state.hasMore = false;
																state.initialized = true;

																if(!state.data.length){
																				render_empty_state("#subscription-available_plans","No plans available");
																				return;
																}

																render_available_plans(state.data, state);
																return;
												}

            const existing = new Set(state.data.map(p => p.plan?.name));

            rows.forEach(row => {
                if (!existing.has(row.plan?.name)) {
                    state.data.push(row);
                }
            });

            state.offset += rows.length;
            state.initialized = true;

            if(rows.length < state.limit){
                state.hasMore = false;
            }

            render_available_plans(state.data, state);
        }
    });

}

function render_invoice_details(inv){

const pdf_url =
    `/api/method/dt_tenant.api.tenant_subscription.download_invoice?invoice_name=${inv.name}&prt_format=Sales%20Invoice%20Print`;

    const html = `

        <div class="plan-card">

            <h3>Invoice ${inv.name}</h3>

            <div class="meta-list">
                <div><b>Status:</b> ${inv.status}</div>
                <div><b>Invoice Date:</b> ${inv.posting_date}</div>
                <div><b>Due Date:</b> ${inv.due_date || "-"}</div>
            </div>

            <hr>

            <div class="plan-limits">

                <div>
                    Total
                    <b>${inv.currency} ${inv.grand_total}</b>
                </div>

                <div>
                    Outstanding
                    <b>${inv.currency} ${inv.outstanding_amount}</b>
                </div>

            </div>

            <hr>

            <div class="d-flex gap-2 mt-3">

                ${
                    inv.outstanding_amount > 0
                    ? `<button class="btn btn-primary pay-invoice"
                        data-invoice="${inv.name}">
                        Pay Invoice
                       </button>`
                    : ""
                }

                <a class="btn btn-secondary"
                   href="${pdf_url}"
                   target="_blank">

                    Download PDF
                </a>

            </div>

        </div>
    `;

    const dialog = new frappe.ui.Dialog({
        title: "Invoice Details",
        size: "large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "invoice_details"
            }
        ]
    });

    dialog.fields_dict.invoice_details.$wrapper.html(html);

    dialog.show();
}

function bind_invoice_events(records){

    $(".invoice-row").on("click", function(e){

        if($(e.target).closest(".pay-invoice").length){
            return;
        }

        const index = $(this).data("index");
        const invoice = records[index];

        render_invoice_details(invoice);
    });

}

function render_billing(records){

    if(!records.length){
        render_empty_state("#subscription-billing","No billing history");
        return;
    }

    let html = `
        <table class="table table-bordered invoice-table">
            <thead>
                <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
    `;

    records.forEach((inv,index) => {

        html += `
            <tr class="invoice-row" data-index="${index}">
                <td>${inv.name}</td>
                <td>${inv.posting_date}</td>
                <td>${inv.due_date || "-"}</td>
                <td>${inv.currency} ${inv.grand_total}</td>
                <td>${inv.currency} ${inv.outstanding_amount}</td>
                <td>${inv.status}</td>

                <td>
                    ${
                        inv.outstanding_amount > 0
                        ? `<button class="btn btn-primary btn-sm pay-invoice"
                            data-invoice="${inv.name}">
                            Pay
                           </button>`
                        : "Paid"
                    }
                </td>
            </tr>
        `;
    });

    html += "</tbody></table>";

    $("#subscription-billing").html(html);

    bind_invoice_events(records);
}

function load_billing(tab){

    const state = tab.state;

    if(state.isLoading) return;

    state.isLoading = true;

    frappe.call({
        method:"dt_tenant.api.tenant_subscription.get_billing_history",
        args:{
            limit: state.limit,
            offset: state.offset
        },
        callback:function(r){

            state.isLoading = false;

            const rows = r.message || [];

												if(!rows.length){

																state.hasMore = false;
																state.initialized = true;

																if(!state.data.length){
																				render_empty_state("#subscription-billing","No billing history");
																				return;
																}

																render_billing(state.data);
																return;
												}

            state.data.push(...rows);
            state.offset += rows.length;
            state.initialized = true;

            render_billing(state.data);
        }
    });

}

function render_subscription_banner(capabilities, invoices){

    const banner = $("#subscription-banner");
    banner.empty();

    if(!capabilities) return;

    const status = capabilities.subscription_status;
    const config = SUBSCRIPTION_STATUS[status];

    if(!config || !config.showBanner) return;

    const unpaid = (invoices || []).find(inv => inv.outstanding_amount > 0);

    if(!unpaid) return;

    banner.html(`
        <div class="subscription-banner">

            <div class="banner-left">
                ⚠ Subscription status: <b>${status}</b>.
                Invoice <b>${unpaid.name}</b> is unpaid.
                Outstanding:
                <b>${unpaid.currency} ${unpaid.outstanding_amount}</b>
            </div>

            <div class="banner-right">
                <button class="btn btn-primary btn-sm pay-banner-invoice pay-invoice"
                    data-invoice="${unpaid.name}">
                    Pay Now
                </button>
            </div>

        </div>
    `);

}

function show_payment_gateways(invoice, btn){

    frappe.call({
        method: "dt_tenant.api.tenant_subscription.get_payment_gateways",
        callback: function(r){

            const gateways = r.message || [];

            if(!gateways.length){
                frappe.msgprint("No payment gateways available");
                return;
            }

            let html = `<div class="gateway-list">`;

            gateways.forEach(g => {

                html += `
                    <button class="btn btn-primary gateway-option"
                        data-gateway="${g.type}"
                        data-instance="${g.instance}"
                        data-controller="${g.controller}"
                        data-requires-method="${g.requires_payment_method}"
                        data-invoice="${invoice}">
                        ${g.label}
                    </button>
                `;
            });

            html += `</div>`;

            const dialog = new frappe.ui.Dialog({
                title: "Choose Payment Method",
                fields:[
                    {
                        fieldtype:"HTML",
                        fieldname:"gateways"
                    }
                ]
            });

            dialog.fields_dict.gateways.$wrapper.html(html);

            dialog.show();

            btn.prop("disabled", true);

        }
    });

}

function show_payment_methods(invoice, gateway,instance){

    frappe.call({
        method: "dt_tenant.api.tenant_subscription.get_payment_methods",
        args: {
            invoice_name: invoice,
            gateway: gateway,
            gateway_instance: instance
        },
        callback: function(r){

            const methods = r.message || [];

            if(!methods.length){

                frappe.confirm(
                    "No saved cards. Add a new card?",
                    () => {
                        open_card_dialog(invoice, gateway, instance);
                    }
                );

                return;
            }

            let html = `<div class="payment-method-list">`;

            methods.forEach(m => {

                const label = `${m.card?.network || "CARD"} ****${m.card?.last4 || ""}`;

                html += `
                    <button class="payment-method-option"
                        data-method="${m.id}"
                        data-instance="${instance}"
                        data-invoice="${invoice}"
                        data-gateway="${gateway}">
                        ${label}
                    </button>
                `;
            });

            /* ADD CARD BUTTON */

            html += `
                <button class="btn btn-secondary add-payment-method"
                    data-instance="${instance}"
                    data-gateway="${gateway}"
                    data-invoice="${invoice}">
                    + Add New Card
                </button>
            `;

            html += `</div>`;

            const dialog = new frappe.ui.Dialog({
                title: __("Choose Payment Method"),
                fields: [
                    {
                        fieldtype: "HTML",
                        fieldname: "methods"
                    }
                ]
            });

            dialog.fields_dict.methods.$wrapper.html(html);

            dialog.show();
        }
    });

}

function generate_nonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 12; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function encryptField(value, base64Key, nonce) {

    const key = base64ToBytes(base64Key);
    const iv = asmCrypto.string_to_bytes(nonce);
    const data = asmCrypto.string_to_bytes(value);

    const encrypted = asmCrypto.AES_GCM.encrypt(data, key, iv);

    return btoa(String.fromCharCode(...encrypted));
}

async function encrypt_card(values,gateway, instance) {

    const r = await frappe.call({
        method: "dt_tenant.api.tenant_subscription.get_encryption_key",
        args: {
            gateway: gateway,
            gateway_instance: instance
        }
    });

    const key = r.message;
    const nonce = generate_nonce();

    return {
        nonce: nonce,
        encrypted_card_number: encryptField(values.number, key, nonce),
        encrypted_expiry_month: encryptField(values.expiry_month, key, nonce),
        encrypted_expiry_year: encryptField(values.expiry_year, key, nonce),
        encrypted_cvv: encryptField(values.cvv, key, nonce)
    };
}

async function open_card_dialog(invoice, gateway, instance){

    const dialog = new frappe.ui.Dialog({
        title: "Add Card",

        fields: [
            {
                fieldtype: "Data",
                fieldname: "number",
                label: "Card Number",
                reqd: 1
            },
            {
                fieldtype: "Data",
                fieldname: "expiry_month",
                label: "Expiry Month",
                reqd: 1
            },
            {
                fieldtype: "Data",
                fieldname: "expiry_year",
                label: "Expiry Year",
                reqd: 1
            },
            {
                fieldtype: "Data",
                fieldname: "cvv",
                label: "CVV",
                reqd: 1
            }
        ],

        primary_action_label: "Save Card",

        primary_action: async function(values){

            frappe.dom.freeze("Encrypting card...");

            const encrypted = await encrypt_card(values,gateway,instance);

            frappe.dom.unfreeze();

            frappe.dom.freeze("Adding card...");

            frappe.call({
                method: "dt_tenant.api.tenant_subscription.create_payment_method",
                args:{
                    gateway: gateway,
                    gateway_instance: instance,
                    reference: invoice,   // added
                    type: "card",
                    details: JSON.stringify(encrypted)
                },

                callback(r){

                    frappe.dom.unfreeze();

                    dialog.hide();

                    frappe.show_alert({
                        message: "Card added",
                        indicator: "green"
                    });

                    show_payment_methods(invoice, gateway, instance);
                }
            });

        }
    });

    dialog.show();
}

frappe.pages['tenant_subscription'].on_page_load = function(wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Tenant Subscription",
        single_column: true
    });

    const main = $(wrapper).find(".layout-main-section");

    const tabListHtml = SUB_TABS.map(tab => `
        <li class="nav-item">
            <a class="nav-link ${tab.active ? "active" : ""}"
               data-tab="${tab.key}"
               href="#">
               ${tab.label}
            </a>
        </li>
    `).join("");

    main.html(`
        <div class="subscription-wrapper">
			<div id="subscription-banner"></div>
            <div class="subscription-tabs">
                <ul class="nav nav-tabs" id="subscription-tabs">
                    ${tabListHtml}
                </ul>
            </div>

            <div class="subscription-body mt-4" id="subscription-tab-content"></div>

        </div>
    `);

    const defaultTab = SUB_TABS.find(t => t.active)?.key || SUB_TABS[0].key;
    render_subscription_tab(defaultTab);

    main.find(".nav-link").on("click", function(e){
        e.preventDefault();

        main.find(".nav-link").removeClass("active");
        $(this).addClass("active");

        render_subscription_tab($(this).data("tab"));
    });
    $(document).on("click",".load-more-plans",function(){

        const btn = $(this);
        btn.prop("disabled", true).text("Loading...");

        const tab = SUB_TABS.find(t => t.key === "available_plans");

        load_available_plans(tab);

    });

    $(document).on("click", ".upgrade-plan", function(e){

        e.stopPropagation();

        const btn = $(this);
        const plan = btn.data("plan");

        frappe.confirm(
            `Switch subscription to this plan?`,
            function(){

                btn.prop("disabled", true).text("Updating...");

                frappe.call({
                    method: "dt_tenant.api.tenant_subscription.change_subscription_plan",
                    args: {
                                    plan_name: plan
                    },
                    callback: function(r){

                        btn.prop("disabled", false).text("Choose Plan");

                        if(!r.message){
                                        frappe.msgprint("Unable to change plan");
                                        return;
                        }

                        frappe.show_alert({
                                        message: "Subscription updated",
                                        indicator: "green"
                        });

                        /* reload subscription data */
                        const tab = SUB_TABS.find(t => t.key === "current_plan");
                        tab.state.initialized = false;
                    }
                });

            }
        );

    });

    $(document).on("click", ".pay-invoice", function (e) {

        e.stopPropagation();

        const btn = $(this);
        const invoice = btn.data("invoice");
        btn.prop("disabled", true);

        frappe.confirm(
            __("Proceed to payment for invoice {0}?", [invoice]),
            function () {

                show_payment_gateways(invoice, btn);

            }
        );

    });

    $(document).on("click", ".gateway-option", function(){

        const gateway = $(this).data("gateway");
        const invoice = $(this).data("invoice");
        const requiresMethods = $(this).data("requires-method");
        const instance = $(this).data("instance");

        if (gateway === "MPesa") {

            const dialog = new frappe.ui.Dialog({
                title: "Enter M-Pesa Number",
                fields: [
                    {
                        label: "Phone Number",
                        fieldname: "phone",
                        fieldtype: "Data",
                        reqd: 1
                    }
                ],
                primary_action_label: "Pay",
                primary_action(values) {

                    frappe.call({
                        method: "dt_tenant.api.tenant_subscription.pay_invoice",
                        args: {
                            invoice_name: invoice,
                            gateway: gateway,
                            gateway_instance: instance,
                            phone: values.phone
                        },
                        freeze: true,
                        freeze_message: "Sending STK Push...",

                        callback(r) {

                            if(!r.message){
                                frappe.msgprint("Payment request failed");
                                return;
                            }

                            frappe.show_alert({
                                message: "STK push sent to phone",
                                indicator: "blue"
                            });

                            dialog.hide();
                        }
                    });
                }
            });

            dialog.show();
            return;
        }

        if (requiresMethods) {
            show_payment_methods(invoice, gateway, instance);
            return;
        }

        frappe.call({
            method: "dt_tenant.api.tenant_subscription.pay_invoice",
            args: {
                invoice_name: invoice,
                gateway: gateway,
                gateway_instance: instance
            },
            freeze: true,
            freeze_message: __("Processing payment..."),

            callback: function(r){

                if(!r.message || !r.message.success){
                    frappe.msgprint("Payment failed");
                    return;
                }

                frappe.show_alert({
                    message: "Payment successful",
                    indicator: "green"
                });

                location.reload();
            }
        });

    });

    $(document).on("click", ".payment-method-option", function(){

        const method = $(this).data("method");
        const invoice = $(this).data("invoice");
        const gateway = $(this).data("gateway");
        const instance = $(this).data("instance");

        frappe.call({
            method: "dt_tenant.api.tenant_subscription.pay_invoice",
            args: {
                invoice_name: invoice,
                gateway: gateway,
                gateway_instance: instance,
                payment_method_id: method
            },
            freeze: true,
            freeze_message: __("Processing payment..."),

            callback: function(r){

                if(!r.message || !r.message.success){
                    frappe.msgprint("Payment failed");
                    return;
                }

                frappe.show_alert({
                    message: "Payment successful",
                    indicator: "green"
                });

                location.reload();
            }
        });

    });

    $(document).on("click", ".add-payment-method", function(){

        frappe.require([
            "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/asmCrypto/2.3.2/asmcrypto.all.es5.min.js"
        ]);

        const gateway = $(this).data("gateway");
        const instance = $(this).data("instance");
        const invoice = $(this).data("invoice");

        open_card_dialog(invoice, gateway, instance);

    });

};

$('<style>').text(`

	/* BASE TAB */
.nav-tabs .nav-link {
    border: 1px solid transparent;
    border-bottom: none;
    color: var(--text-muted);
    position: relative;
    margin-bottom: -1px; /* sits on border line */
}

/* HOVER (non-active) */
.nav-tabs .nav-link:not(.active):hover {
    border-top: 1px solid var(--text-color);
    border-left: 1px solid var(--text-color);
    border-right: 1px solid var(--text-color);
    border-bottom: none;
    color: var(--text-color);
}

/* ACTIVE TAB */
.nav-tabs .nav-link.active {
    color: var(--text-color);
    background: transparent;

    border-top: 1px solid var(--text-color);
    border-left: 1px solid var(--text-color);
    border-right: 1px solid var(--text-color);
    border-bottom: 1px solid var(--card-bg); /* hides bottom line */

    border-top-left-radius: 10px;
    border-top-right-radius: 10px;

    margin-bottom: -1px; /* overlaps container line */
    z-index: 2;
}

/* PLAN CARD */
.plan-card {
    padding: 20px;
    background: var(--card-bg);
    max-width: 720px;
    transition: 0.15s ease;
}

/* PLAN TITLE */
.plan-title {
    font-size: 20px;
    font-weight: 600;
}

/* PLAN STATUS */
.plan-status {
    color: var(--text-muted);
    font-size: 13px;
}

/* LIMIT GRID */
.plan-limits {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-top: 10px;
}

/* LIMIT ITEM */
.limit-item {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px;
    font-size: 13px;
    background: var(--card-bg);
}

.limit-item b {
    float: right;
}

.plan-summary{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:8px;
    font-size:13px;
    margin-top:10px;
}

.plan-summary div{
    border:1px solid var(--border-color);
    padding:6px 8px;
    border-radius:6px;
}

.empty-state{
    text-align:center;
    padding:40px 0;
    color:var(--text-muted);
}

.empty-icon{
    font-size:28px;
    margin-bottom:8px;
}

`).appendTo('head');

$('<style>').text(`

.plan-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
}

.plan-option {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    background: var(--card-bg);
    transition: 0.15s ease;
}

.plan-option:hover {
    border-color: var(--text-color);
    transform: translateY(-2px);
}

.plan-price {
    font-size: 20px;
    font-weight: 600;
}

`).appendTo('head');

$('<style>').text(`

.meta-list{
    font-size:13px;
    color:var(--text-muted);
}

.plan-limits{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:12px;
}

.plan-limits div{
    border:1px solid var(--border-color);
    padding:8px 10px;
    border-radius:6px;
    font-size:13px;
    background:var(--card-bg);
}

.invoice-table{
    border-collapse: separate;
    border-spacing: 0;
}

.invoice-row{
    cursor: pointer;
    transition: background 0.15s ease;
}

/* Base cell borders */

.invoice-row td{
    background: var(--card-bg);
    border-top: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
}

/* Left corner */

.invoice-row td:first-child{
    border-left: 1px solid var(--border-color);
    border-radius: 6px 0 0 6px;
}

/* Right corner */

.invoice-row td:last-child{
    border-right: 1px solid var(--border-color);
    border-radius: 0 6px 6px 0;
}

/* Hover entire row */
.invoice-table tbody tr.invoice-row:hover {
    background-color: var(--text-color) !important;
}

/* Force cells to use same background */
.invoice-table tbody tr.invoice-row:hover > td {
    background-color: var(--text-color) !important;
    color: var(--bg-color) !important;
}

/* Force ALL inner text to invert */
.invoice-table tbody tr.invoice-row:hover td,
.invoice-table tbody tr.invoice-row:hover td *,
.invoice-table tbody tr.invoice-row:hover a,
.invoice-table tbody tr.invoice-row:hover span,
.invoice-table tbody tr.invoice-row:hover button {
    color: var(--bg-color) !important;
}

.subscription-banner{
    display:flex;
    justify-content:space-between;
    align-items:center;

    padding:12px 16px;
    margin-bottom:14px;

    border:1px solid var(--border-color);
    background:var(--card-bg);
    border-left:4px solid var(--orange-500);

    border-radius:8px;
    font-size:14px;
}

.banner-left{
    font-weight:500;
    color:var(--text-color);
}

.banner-right{
    display:flex;
    gap:8px;
}
`).appendTo('head');

$('<style>').text(`
.status-badge{
    display:inline-block;
    padding:4px 10px;
    border-radius:20px;
    font-size:12px;
    font-weight:600;
    margin-top:6px;
}

.status-green{ background:#16a34a20; color:#22c55e; }
.status-orange{ background:#f59e0b20; color:#f59e0b; }
.status-red{ background:#ef444420; color:#ef4444; }
.status-gray{ background:#6b728020; color:#9ca3af; }
`).appendTo('head');

$('<style>').text(`

.payment-method-list{
    display:flex;
    flex-direction:column;
    gap:12px;
    margin-top:10px;
}

.payment-method-option{
    width:100%;
    padding:12px 16px;

    border:1px solid var(--border-color);
    border-radius:8px;

    background:var(--card-bg);
    color:var(--text-color);

    font-weight:500;
    text-align:center;

    transition:all 0.15s ease;
}

.payment-method-option:hover{
    border-color:var(--text-color);
    transform:translateY(-1px);
    background:var(--card-bg);
}

.payment-method-option:active{
    transform:translateY(0);
}

`).appendTo('head');

$('<style>').text(`

.gateway-list{
    display:flex;
    flex-direction:column;
    gap:12px;
    margin-top:10px;
}

.gateway-option{
    width:100%;
    padding:12px 16px;

    border:1px solid var(--border-color);
    border-radius:8px;

    background:var(--card-bg);
    color:var(--text-color);

    font-weight:500;
    text-align:center;

    transition:all 0.15s ease;
}

.gateway-option:hover{
    border-color:var(--text-color);
    transform:translateY(-1px);
}

.gateway-option:active{
    transform:translateY(0);
}

`).appendTo('head');

if (!document.getElementById("tenant-subscription-styles")) {
    $('<style id="tenant-subscription-styles">').text(` ...css... `).appendTo('head');
}