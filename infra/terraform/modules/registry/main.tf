resource "azurerm_container_registry" "this" {
  name                   = var.name
  resource_group_name    = var.resource_group_name
  location               = var.location
  sku                    = var.sku
  admin_enabled          = false
  anonymous_pull_enabled = false
  tags                   = var.tags
}
resource "azurerm_role_assignment" "pull" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPull"
  principal_id         = var.runtime_principal_id
}
resource "azurerm_role_assignment" "push" {
  scope                = azurerm_container_registry.this.id
  role_definition_name = "AcrPush"
  principal_id         = var.deploy_principal_id
}
output "name" { value = azurerm_container_registry.this.name }
output "id" { value = azurerm_container_registry.this.id }
output "login_server" { value = azurerm_container_registry.this.login_server }
