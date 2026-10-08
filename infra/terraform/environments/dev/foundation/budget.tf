resource "azurerm_consumption_budget_resource_group" "this" {
  count             = var.budget == null ? 0 : 1
  name              = "${var.name}-monthly-budget"
  resource_group_id = data.azurerm_resource_group.this.id
  amount            = var.budget.amount
  time_grain        = "Monthly"
  time_period { start_date = var.budget.start_date }
  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThanOrEqualTo"
    contact_emails = [var.budget.email]
  }
  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    contact_emails = [var.budget.email]
  }
}
