
const TABS = [
    {
        key: "marketplace",
        label: "Marketplace",
        active: true,
        state: {
            offset: 0,
            hasMore: true,
            isLoading: false,
            initialized: false,
            data: []
        }
    },
    {
        key: "installed",
        label: "Installed Apps",
        state: {
            offset: 0,
            hasMore: true,
            isLoading: false,
            initialized: false,
            data: []
        }
    },
    {
        key: "uninstalled",
        label: "Uninstalled Apps",
        state: {
            offset: 0,
            hasMore: true,
            isLoading: false,
            initialized: false,
            data: []
        }
    }
];
window.FRAPPE_VERSION = frappe.boot?.versions?.frappe || null;

function normalizeVersion(version) {
    if (!version) return [0, 0, 0];

    // Remove anything after first hyphen (dev, beta, rc, etc.)
    const clean = version.split("-")[0];

    return clean
        .split(".")
        .map(part => parseInt(part, 10) || 0);
}

function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;

    const a = normalizeVersion(v1);
    const b = normalizeVersion(v2);

    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function isFrappeCompatible(ext) {
    const current = window.FRAPPE_VERSION;
    if (!current) return true; // fail-open if unknown

    if (ext.min_frappe_version &&
        compareVersions(current, ext.min_frappe_version) < 0) {
        return false;
    }

    if (ext.max_frappe_version &&
        compareVersions(current, ext.max_frappe_version) > 0) {
        return false;
    }

    return true;
}

function render_action_buttons(ext) {

    const compatible = isFrappeCompatible(ext);

    if (!compatible) {
        return `
            <button class="btn btn-secondary btn-sm" disabled>
                Incompatible with Frappe ${window.FRAPPE_VERSION}
            </button>
        `;
    }

    if (!ext.installed) {
        return `
            <button class="btn btn-primary btn-sm action-btn"
                    data-action="install"
                    data-name="${ext.name}">
                Install
            </button>
        `;
    }

    if (ext.installed && ext.upgradable) {
        return `
            <button class="btn btn-warning btn-sm action-btn"
                    data-action="upgrade"
                    data-name="${ext.name}">
                Upgrade
            </button>
            <button class="btn btn-danger btn-sm action-btn"
                    data-action="uninstall"
                    data-name="${ext.name}">
                Uninstall
            </button>
        `;
    }

    if (ext.installed) {
        return `
            <button class="btn btn-danger btn-sm action-btn"
                    data-action="uninstall"
                    data-name="${ext.name}">
                Uninstall
            </button>
        `;
    }

    return "";
}

function render_extension_card(ext) {
    return `
        <div class="addon-card" data-extension="${ext.name}">

            <div class="addon-card-header">
                <img src="${ext.icon || '/assets/frappe/images/frappe-framework-logo.svg'}" 
                     class="addon-icon" />

                <div>
                    <h5 class="truncate-text">${ext.title || ext.extension_name}</h5>
                    <div class="text-muted small truncate-text">
                        ${ext.publisher || ""}
                    </div>
                </div>
            </div>

            <div class="addon-card-body">
                <p class="text-muted">
                    ${ext.short_description || ""}
                </p>
            </div>

            <div class="addon-card-footer">
                ${render_action_buttons(ext)}
            </div>

        </div>
    `;
}

function load_extensions(tab, gridSelector) {

    const grid = $(gridSelector);
    const state = tab.state;


    // If already loading or no more data, do nothing
    if (state.isLoading || !state.hasMore){
        if (!state.hasMore && state.data.length === 0) {
            grid.html(`<div class="text-muted">No extensions found</div>`);
        }
        return;
    }

    state.isLoading = true;

    // Only show loading indicator on FIRST load
    if (!state.initialized) {
        grid.html(`<div class="text-muted">Loading...</div>`);
    }

    frappe.call({
        method: "dt_tenant.api.extensions.get_marketplace_extensions",
        type: "GET",
        args: {
            tab: tab.key,
            limit: 12,
            offset: state.offset
        },
        callback: function (r) {

            state.isLoading = false;

            if (!r.message || !r.message.length) {
                state.hasMore = false;

                // Only show empty message if no cached data
                if (state.data.length === 0) {
                    grid.html(`<div class="text-muted">No extensions found</div>`);
                }

                return;
            }

            // Update state FIRST
            state.data.push(...r.message);
            state.offset += r.message.length;
            state.initialized = true;
            // Render from state
            render_from_state(tab, gridSelector);
        }
    });
}

function render_from_state(tab, gridSelector) {

    const grid = $(gridSelector);
    const state = tab.state;

    grid.empty();

    if (state.data.length===0) {
        grid.html(`<div class="text-muted">No extensions found</div>`);
        return;
    }

    state.data.forEach(ext => {
        grid.append(render_extension_card(ext));
    });
}

function render_tab(tabKey) {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return;

    $("#addon-tab-content").html(`
        <div class="addon-section">
            <div class="addon-grid" id="grid-${tab.key}"></div>
        </div>
    `);

				// If already loaded once, render from cache
    if (tab.state.initialized) {
        render_from_state(tab, `#grid-${tab.key}`);
        return;
    }

    load_extensions(tab, `#grid-${tab.key}`);
}

function get_extension_from_state(name) {

    for (const tab of TABS) {
        const ext = tab.state.data.find(e => e.name === name);
        if (ext) return ext;
    }

    return null;
}

function open_extension_details(name) {

    const ext = get_extension_from_state(name);

    if (!ext) {
        frappe.msgprint("Extension not found");
        return;
    }

    const dialog = new frappe.ui.Dialog({
        title: ext.title || ext.name,
        size: "large",
        fields: [
            {
                fieldtype: "HTML",
                fieldname: "content"
            }
        ]
    });

    const pricing =
        ext.price_type === "Free"
            ? "Free"
            : `${ext.price_amount || 0} (${ext.pricing_model || "one-time"})`;

    const security = ext.security_reviewed ? "✔ Security reviewed" : "⚠ Not reviewed";

    dialog.fields_dict.content.$wrapper.html(`
        <div class="extension-details">

            <div class="ext-header">
                <img src="${ext.icon || '/assets/frappe/images/frappe-framework-logo.svg'}" />

                <div>
                    <h3>${ext.title || ext.name}</h3>
                    <div class="text-muted">${ext.publisher || ""}</div>
                </div>
            </div>

            <hr>

            <p>${ext.description || ext.short_description || ""}</p>

            <hr>

            <div class="ext-meta">

                <div><b>Latest Version:</b> ${ext.latest_version || "-"}</div>
                <div><b>Installed Version:</b> ${ext.installed_version || "-"}</div>

                <div><b>Frappe Compatibility:</b>
                    ${ext.min_frappe_version || "?"}
                    →
                    ${ext.max_frappe_version || "?"}
                </div>

                <div><b>Pricing:</b> ${pricing}</div>

                <div><b>Security:</b> ${security}</div>

                <div><b>Visibility:</b> ${ext.visibility}</div>

            </div>

        </div>
    `);

    dialog.show();
}

function listen_for_extension_updates() {

    frappe.realtime.on("extension_install_update", (data) => {

        console.log("Realtime update:", data);

        const card = $(`.addon-card[data-extension="${data.extension}"]`);
        if (!card.length) return;

        const footer = card.find(".addon-card-footer");

        if (data.action_status === "Running") {

            footer.html(`
                <button class="btn btn-secondary btn-sm" disabled>
                    Processing...
                </button>
            `);

            return;
        }

        if (data.status === "Installed") {

            footer.html(`
                <button class="btn btn-danger btn-sm action-btn"
                        data-action="uninstall"
                        data-name="${data.extension}">
                    Uninstall
                </button>
            `);

            frappe.show_alert({
                message: `${data.extension} installed`,
                indicator: "green"
            });

            return;
        }

        if (data.status === "Uninstalled") {

            footer.html(`
                <button class="btn btn-primary btn-sm action-btn"
                        data-action="install"
                        data-name="${data.extension}">
                    Install
                </button>
            `);

            frappe.show_alert({
                message: `${data.extension} removed`,
                indicator: "orange"
            });

            return;
        }

        if (data.action_status === "Failed") {

            footer.html(`
                <button class="btn btn-primary btn-sm action-btn"
                        data-action="install"
                        data-name="${data.extension}">
                    Retry
                </button>
            `);

            frappe.msgprint({
                title: "Action Failed",
                message: data.error || "Unknown error",
                indicator: "red"
            });
        }

    });

}

function init_realtime() {

    if (!frappe.realtime) return;

    frappe.realtime.on("connect", () => {
        console.log("Realtime connected");
        listen_for_extension_updates();
    });

}

function call_extension_action(action, extensionName, btn) {

    btn.prop("disabled", true).text("Processing...");

    const methods = {
        install: "dt_tenant.api.marketplace.install_extension",
        upgrade: "dt_tenant.api.marketplace.upgrade_extension",
        uninstall: "dt_tenant.api.marketplace.uninstall_extension"
    };

    frappe.call({
        method: methods[action],
        args: {
            extension_name: extensionName
        },
        freeze: true,
        freeze_message: __("Processing request..."),

        callback() {
            frappe.show_alert({
                message: __("Action queued"),
                indicator: "blue"
            });
        },

        error() {
            btn.prop("disabled", false).text(action);

            frappe.msgprint({
                title: __("Action Failed"),
                message: __("Unable to start action"),
                indicator: "red"
            });
        }
    });
}

frappe.pages['add_ons'].on_page_load = function (wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Add Ons'),
        single_column: true
    });

    init_realtime();

    const main = $(wrapper).find('.layout-main-section');

				// Build tab list dynamically
				const tabListHtml = TABS.map(tab => `
								<li class="nav-item">
												<a class="nav-link ${tab.active ? "active" : ""}" 
															data-tab="${tab.key}" 
															href="#">
																${tab.label}
												</a>
								</li>
				`).join("");

				main.html(`
								<div class="add-ons-wrapper">

												<div class="add-ons-tabs">
																<ul class="nav nav-tabs" id="addon-tabs">
																				${tabListHtml}
																</ul>
												</div>

												<div class="add-ons-body mt-4" id="addon-tab-content"></div>

								</div>
				`);

    // First render
    const defaultTab = TABS.find(t => t.active)?.key || TABS[0].key;
				render_tab(defaultTab);

    // Tab switching
    main.find(".nav-link").on("click", function (e) {
                    e.preventDefault();

                    main.find(".nav-link").removeClass("active");
                    $(this).addClass("active");

                    const tabKey = $(this).data("tab");
                    render_tab(tabKey);
    });

    main.on("click", ".addon-card", function (e) {

        // If user clicked a button, do nothing
        if ($(e.target).closest(".btn").length) {
            return;
        }

        const extensionName = $(this).data("extension");
        open_extension_details(extensionName);
    });

    main.on("click", ".action-btn", function (e) {

        e.stopPropagation();

        const btn = $(this);
        const action = btn.data("action");
        const extensionName = btn.data("name");

        call_extension_action(action, extensionName, btn);

    });

};

$('<style>').text(`

/* TAB GROUP CONTAINER */
.nav-tabs {
    border-bottom: 1px solid var(--text-color); /* continuous white line */
    position: relative;
}

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

/* BODY */
.add-ons-body {
    padding: 24px;
    background: transparent;
}

`).appendTo('head');

$('<style>').text(`

/* GRID */
.addon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
}

/* CARD */
.addon-card {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
    background: var(--card-bg);

    display: flex;
    flex-direction: column;
    height: 160px;
    transition: 0.15s ease;
				cursor: pointer;
}

.addon-card:hover {
    border-color: var(--text-color);
    transform: translateY(-2px);
}

/* HEADER */
.addon-card-header {
    display: flex;
    gap: 10px;
    align-items: center;
}

/* ICON */
.addon-icon {
    width: 36px;
    height: 36px;
    object-fit: contain;
    border-radius: 6px;
}

/* TITLE */
.addon-card h5 {
    font-size: 14px;
    margin: 0;
}
.truncate-text{
				display: -webkit-box;
    -webkit-line-clamp: 1; /* number of visible lines */
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* BODY grows */
.addon-card-body {
    flex: 1;
    margin-top: 8px;
}

/* TRUNCATED DESCRIPTION */
.addon-card-body p {
    font-size: 12px;
    margin: 0;

    display: -webkit-box;
    -webkit-line-clamp: 2; /* number of visible lines */
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* FOOTER pinned bottom */
.addon-card-footer {
    margin-top: 12px;
}

/* SMALLER BUTTONS */
.addon-card .btn {
    padding: 4px 10px;
    font-size: 12px;
}

`).appendTo('head');

$('<style>').text(`

.extension-details {
    padding: 10px;
}

.ext-header {
    display: flex;
    gap: 16px;
    align-items: center;
}

.ext-header img {
    width: 64px;
    height: 64px;
    object-fit: contain;
}

.ext-meta {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    font-size: 13px;
}

`).appendTo('head');