resource "azurerm_container_app_environment" "this" {
  name                               = "${var.name}-environment"
  location                           = var.location
  resource_group_name                = var.resource_group_name
  infrastructure_subnet_id           = var.subnet_id
  infrastructure_resource_group_name = "ME_${var.name}-environment_${var.resource_group_name}_${var.location}"
  log_analytics_workspace_id         = var.workspace_id
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
    minimum_count         = 0
    maximum_count         = 0
  }
  tags = var.tags
}
output "id" { value = azurerm_container_app_environment.this.id }
output "default_domain" { value = azurerm_container_app_environment.this.default_domain }
