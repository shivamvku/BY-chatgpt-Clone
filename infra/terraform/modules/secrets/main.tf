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
  scope                = "${azurerm_key_vault.this.id}/secrets/runtime-database-url"
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.runtime_principal_id
}
resource "azurerm_role_assignment" "migration" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.migration_principal_id
}
resource "azurerm_key_vault_secret" "database" {
  name         = "database-url"
  value        = var.database_url
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
output "database_secret_id" { value = azurerm_key_vault_secret.database.versionless_id }
resource "azurerm_key_vault_secret" "runtime_database" {
  name         = "runtime-database-url"
  value        = var.runtime_database_url
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
output "runtime_database_secret_id" { value = azurerm_key_vault_secret.runtime_database.versionless_id }
resource "azurerm_key_vault_secret" "resend" {
  count        = var.email_enabled ? 1 : 0
  name         = "resend-api-key"
  value        = var.resend_api_key
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
  lifecycle {
    precondition {
      condition     = length(var.resend_api_key) > 20 && startswith(var.resend_api_key, "re_")
      error_message = "Configure the replacement Resend sending key through protected secret input."
    }
  }
}
resource "azurerm_role_assignment" "runtime_email" {
  count                = var.email_enabled ? 1 : 0
  scope                = "${azurerm_key_vault.this.id}/secrets/resend-api-key"
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.runtime_principal_id
}
output "resend_secret_id" { value = var.email_enabled ? azurerm_key_vault_secret.resend[0].versionless_id : "" }
resource "azurerm_key_vault_secret" "gemini" {
  count        = var.gemini_api_key == "" ? 0 : 1
  name         = "gemini-api-key"
  value        = var.gemini_api_key
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
resource "azurerm_key_vault_secret" "groq" {
  count        = var.groq_api_key == "" ? 0 : 1
  name         = "groq-api-key"
  value        = var.groq_api_key
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
resource "azurerm_role_assignment" "runtime_ai" {
  for_each = {
    for name, secret in {
      gemini = try(azurerm_key_vault_secret.gemini[0].versionless_id, "")
      groq   = try(azurerm_key_vault_secret.groq[0].versionless_id, "")
    } : name => secret if secret != ""
  }
  scope                = each.value
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.runtime_principal_id
}
output "gemini_secret_id" { value = try(azurerm_key_vault_secret.gemini[0].versionless_id, "") }
output "groq_secret_id" { value = try(azurerm_key_vault_secret.groq[0].versionless_id, "") }
resource "azurerm_key_vault_secret" "observer" {
  count        = var.observer_enabled ? 1 : 0
  name         = "observer-database-url"
  value        = var.observer_database_url
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.deploy, azurerm_role_assignment.operator]
}
output "observer_secret_id" {
  value = var.observer_enabled ? azurerm_key_vault_secret.observer[0].versionless_id : ""
}

