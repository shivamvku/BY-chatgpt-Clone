provider "azurerm" {
  features {}
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
}
data "azurerm_resource_group" "this" { name = var.resource_group_name }
data "azurerm_client_config" "current" {}
resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}
locals {
  location = data.azurerm_resource_group.this.location
  tags     = { project = "by-chat", environment = "dev", managed_by = "terraform" }
}

module "networking" {
  source              = "../../../modules/networking"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
}

module "identity" {
  source              = "../../../modules/identity"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
}

module "monitoring" {
  source              = "../../../modules/monitoring"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
}

module "registry" {
  source               = "../../../modules/registry"
  name                 = "bychat${random_string.suffix.result}"
  location             = local.location
  resource_group_name  = var.resource_group_name
  tags                 = local.tags
  runtime_principal_id = module.identity.principal_id
  deploy_principal_id  = var.deploy_principal_id
  sku                  = var.registry_sku
}

module "database" {
  source              = "../../../modules/database"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
  subnet_id           = module.networking.database_subnet_id
  dns_zone_id         = module.networking.database_dns_zone_id
  depends_on          = [module.networking]
}

module "secrets" {
  source                = "../../../modules/secrets"
  name                  = "bychat-${random_string.suffix.result}-kv"
  location              = local.location
  resource_group_name   = var.resource_group_name
  tags                  = local.tags
  tenant_id             = data.azurerm_client_config.current.tenant_id
  deploy_principal_id   = var.deploy_principal_id
  operator_principal_id = var.operator_principal_id
  plan_principal_id     = var.plan_principal_id
  runtime_principal_id  = module.identity.principal_id
  database_url          = module.database.connection_url
}

module "container_environment" {
  source              = "../../../modules/container-environment"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
  subnet_id           = module.networking.apps_subnet_id
  workspace_id        = module.monitoring.workspace_id
}
