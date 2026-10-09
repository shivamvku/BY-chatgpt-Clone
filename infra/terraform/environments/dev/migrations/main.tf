provider "azurerm" {
  features {}
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
}
data "terraform_remote_state" "foundation" {
  backend = "azurerm"
  config = {
    resource_group_name  = var.state_resource_group
    storage_account_name = var.state_storage_account
    container_name       = "tfstate"
    key                  = "dev/foundation.tfstate"
    use_azuread_auth     = true
  }
}
locals { platform = data.terraform_remote_state.foundation.outputs.application }
module "migration" {
  source                     = "../../../modules/migration-job"
  name                       = local.platform.name
  location                   = local.platform.location
  resource_group_name        = local.platform.resource_group_name
  environment_id             = local.platform.environment_id
  identity_id                = local.platform.migration_identity_id
  registry_server            = local.platform.registry_server
  database_secret_id         = local.platform.database_secret_id
  runtime_database_secret_id = local.platform.runtime_database_secret_id
  observer_secret_id         = try(local.platform.observer_secret_id, "")
  release_commit             = var.release_commit
  tags                       = local.platform.tags
  image                      = var.image
}
output "migration_job_name" { value = module.migration.name }
output "release_image" { value = var.image }
output "release_commit" { value = var.release_commit }
module "operator" {
  source              = "../../../modules/operator-job"
  name                = local.platform.name
  location            = local.platform.location
  resource_group_name = local.platform.resource_group_name
  environment_id      = local.platform.environment_id
  identity_id         = local.platform.identity_id
  registry_server     = local.platform.registry_server
  database_secret_id  = local.platform.runtime_database_secret_id
  image               = var.image
  tags                = local.platform.tags
  operation           = var.operation
  operator_email      = var.operator_email
  operator_actor      = var.operator_actor
}
output "operator_job_name" { value = module.operator.name }
