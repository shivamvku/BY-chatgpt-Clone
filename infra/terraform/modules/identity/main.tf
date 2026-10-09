resource "azurerm_user_assigned_identity" "runtime" {
  name                = "${var.name}-runtime"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}
output "id" { value = azurerm_user_assigned_identity.runtime.id }
output "principal_id" { value = azurerm_user_assigned_identity.runtime.principal_id }
output "client_id" { value = azurerm_user_assigned_identity.runtime.client_id }
