resource "azurerm_key_vault" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  purge_protection_enabled   = true
  soft_delete_retention_days = 7
  tags                       = var.tags
}
resource "azurerm_role_assignment" "deploy" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.deploy_principal_id
}
resource "azurerm_role_assignment" "operator" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.operator_principal_id
}
resource "azurerm_role_assignment" "plan" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.plan_principal_id
}
resource "azurerm_role_assignment" "runtime" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.runtime_principal_id
}
resource "azurerm_key_vault_secret" "database" {
  name         = "database-url"
  value        = var.database_url
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
output "database_secret_id" { value = azurerm_key_vault_secret.database.versionless_id }

