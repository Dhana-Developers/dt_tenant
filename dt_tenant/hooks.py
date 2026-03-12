app_name = "dt_tenant"
app_title = "Dt Tenant"
app_publisher = "Dhana Technologies"
app_description = "Dhana technoligies tenant apps for renting customers"
app_email = "enquiries@dhanatehcnologies.com"
app_license = "agpl-3.0"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "dt_tenant",
# 		"logo": "/assets/dt_tenant/logo.png",
# 		"title": "Dt Tenant",
# 		"route": "/dt_tenant",
# 		"has_permission": "dt_tenant.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/dt_tenant/css/dt_tenant.css"
# app_include_js = "/assets/dt_tenant/js/dt_tenant.js"

# include js, css files in header of web template
# web_include_css = "/assets/dt_tenant/css/dt_tenant.css"
# web_include_js = "/assets/dt_tenant/js/dt_tenant.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "dt_tenant/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "dt_tenant/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "dt_tenant.utils.jinja_methods",
# 	"filters": "dt_tenant.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "dt_tenant.install.before_install"
# after_install = "dt_tenant.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "dt_tenant.uninstall.before_uninstall"
# after_uninstall = "dt_tenant.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "dt_tenant.utils.before_app_install"
# after_app_install = "dt_tenant.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "dt_tenant.utils.before_app_uninstall"
# after_app_uninstall = "dt_tenant.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "dt_tenant.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	},
    "User": {
        "after_insert": "dt_tenant.controllers.user_roles.assign_roles",
        "before_save": "dt_tenant.controllers.user_roles.sync_tenant_permissions"
    }
}

# Scheduled Tasks
# ---------------

scheduler_events = {
# 	"all": [
# 		"dt_tenant.tasks.all"
# 	],
# 	"daily": [
# 		"dt_tenant.tasks.daily"
# 	],
# 	"hourly": [
# 		"dt_tenant.tasks.hourly"
# 	],
# 	"weekly": [
# 		"dt_tenant.tasks.weekly"
# 	],
# 	"monthly": [
# 		"dt_tenant.tasks.monthly"
# 	],
    "cron": {
        "0 */6 * * *": [
            "dt_tenant.controllers.capability_scheduler.run_scheduled_sync"
        ]
    }
}

# Testing
# -------

# before_tests = "dt_tenant.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "dt_tenant.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	# "frappe.desk.doctype.event.event.get_events": "dt_tenant.event.get_events",
#     "frappe.desk.desktop.get_desktop_page": "dt_tenant.dt_tenant.workspace.workspace_filter.filter_workspace"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "dt_tenant.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = [
#     # "dt_tenant.utils.before_request",
#     "dt_tenant.security.subscription_guard.enforce_subscription"
#     ]
# after_request = ["dt_tenant.utils.after_request"]

# Job Events
# ----------
# before_job = ["dt_tenant.utils.before_job"]
# after_job = ["dt_tenant.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"dt_tenant.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            ["dt", "=", "User"],
            ["module", "=", "Dt Tenant"]
        ]
    }
]

payment_gateway_settings = [
    "Flutterwave Settings"
]

