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
module "app" {
  source              = "../../../modules/container-app"
  name                = local.platform.name
  location            = local.platform.location
  resource_group_name = local.platform.resource_group_name
  environment_id      = local.platform.environment_id
  identity_id         = local.platform.identity_id
  registry_server     = local.platform.registry_server
  database_secret_id  = local.platform.runtime_database_secret_id
  tags                = local.platform.tags
  image               = var.image
  app_config = merge(jsondecode(file("${path.module}/../../../../config/app.json")), {
    allowed_origins = "${jsondecode(file("${path.module}/../../../../config/app.json")).allowed_origins},https://${local.platform.name}.${local.platform.environment_domain}"
    llm_endpoint    = local.platform.llm_endpoint
    llm_model       = local.platform.llm_model
    azure_client_id = local.platform.azure_client_id
  })
}
output "url" { value = module.app.url }
