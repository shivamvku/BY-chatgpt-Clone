provider "azurerm" {
  features {}
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
  storage_use_azuread             = true
}
data "azurerm_client_config" "current" {}
resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}
locals {
  tags = { project = "by-chat", environment = "dev", managed_by = "terraform" }
}
resource "azurerm_resource_group" "state" {
  name     = "${var.name}-tfstate-rg"
  location = var.location
  tags     = local.tags
}
resource "azurerm_resource_group" "app" {
  name     = "${var.name}-rg"
  location = var.location
  tags     = local.tags
}
resource "azurerm_storage_account" "state" {
  depends_on                      = [azurerm_role_assignment.operator_state]
  name                            = "bychatstate${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  blob_properties {
    versioning_enabled = true
    delete_retention_policy { days = 7 }
    container_delete_retention_policy { days = 7 }
  }
  tags = local.tags
  lifecycle { prevent_destroy = true }
}
resource "azurerm_role_assignment" "operator_state" {
  scope                = azurerm_resource_group.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
  depends_on            = [azurerm_role_assignment.operator_state]
}
resource "azurerm_user_assigned_identity" "ci" {
  for_each            = toset(["plan", "deploy"])
  name                = "${var.name}-github-${each.key}"
  location            = var.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = local.tags
}
resource "azurerm_federated_identity_credential" "ci" {
  for_each            = azurerm_user_assigned_identity.ci
  name                = "github-${each.key}"
  resource_group_name = azurerm_resource_group.app.name
  parent_id           = each.value.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:${var.github_repository}:environment:infra-${each.key}"
}
resource "azurerm_role_assignment" "ci_rg" {
  for_each             = azurerm_user_assigned_identity.ci
  scope                = azurerm_resource_group.app.id
  role_definition_name = each.key == "deploy" ? "Contributor" : "Reader"
  principal_id         = each.value.principal_id
}
resource "azurerm_role_assignment" "ci_rbac" {
  scope                = azurerm_resource_group.app.id
  role_definition_name = "Role Based Access Control Administrator"
  principal_id         = azurerm_user_assigned_identity.ci["deploy"].principal_id
}
resource "azurerm_role_assignment" "ci_state" {
  for_each             = azurerm_user_assigned_identity.ci
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value.principal_id
}
output "backend" {
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
    use_azuread_auth     = true
  }
}
output "foundation_inputs" {
  value = {
    resource_group_name   = azurerm_resource_group.app.name
    deploy_principal_id   = azurerm_user_assigned_identity.ci["deploy"].principal_id
    plan_principal_id     = azurerm_user_assigned_identity.ci["plan"].principal_id
    operator_principal_id = data.azurerm_client_config.current.object_id
  }
}
output "github_variables" {
  value = {
    AZURE_APP_NAME              = var.name
    AZURE_DEPLOY_PRINCIPAL_ID   = azurerm_user_assigned_identity.ci["deploy"].principal_id
    AZURE_PLAN_PRINCIPAL_ID     = azurerm_user_assigned_identity.ci["plan"].principal_id
    AZURE_OPERATOR_PRINCIPAL_ID = data.azurerm_client_config.current.object_id
    AZURE_TENANT_ID             = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID       = var.subscription_id
    AZURE_DEPLOY_CLIENT_ID      = azurerm_user_assigned_identity.ci["deploy"].client_id
    AZURE_PLAN_CLIENT_ID        = azurerm_user_assigned_identity.ci["plan"].client_id
    TF_STATE_RESOURCE_GROUP     = azurerm_resource_group.state.name
    TF_STATE_STORAGE_ACCOUNT    = azurerm_storage_account.state.name
    AZURE_RESOURCE_GROUP        = azurerm_resource_group.app.name
  }
}
