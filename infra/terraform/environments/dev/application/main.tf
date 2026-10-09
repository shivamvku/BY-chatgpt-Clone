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
  resource_group_name = local.platform.resource_group_name
  environment_id      = local.platform.environment_id
  identity_id         = local.platform.identity_id
  registry_server     = local.platform.registry_server
  database_secret_id  = local.platform.runtime_database_secret_id
  resend_secret_id    = try(local.platform.resend_secret_id, "")
  tags                = local.platform.tags
  image               = var.image
  app_config = merge(jsondecode(file("${path.module}/../../../../config/app.json")), {
    allowed_origins = "${jsondecode(file("${path.module}/../../../../config/app.json")).allowed_origins},https://${local.platform.name}.${local.platform.environment_domain}"
    llm_endpoint    = local.platform.llm_endpoint
    llm_model       = local.platform.llm_model
    azure_client_id = local.platform.azure_client_id
    public_url      = jsondecode(file("${path.module}/../../../../config/email.json")).public_url
    email_from      = jsondecode(file("${path.module}/../../../../config/email.json")).enabled ? jsondecode(file("${path.module}/../../../../config/email.json")).from : ""
  })
}
output "url" { value = module.app.url }

resource "azurerm_container_app_job" "retention" {
  name                         = "${local.platform.name}-retention"
  location                     = local.platform.location
  resource_group_name          = local.platform.resource_group_name
  container_app_environment_id = local.platform.environment_id
  replica_timeout_in_seconds   = 300
  replica_retry_limit          = 0
  workload_profile_name        = "Consumption"
  tags                         = local.platform.tags
  schedule_trigger_config {
    cron_expression          = "0 2 * * *"
    parallelism              = 1
    replica_completion_count = 1
  }
  identity {
    type         = "UserAssigned"
    identity_ids = [local.platform.identity_id]
  }
  registry {
    server   = local.platform.registry_server
    identity = local.platform.identity_id
  }
  secret {
    name                = "database-url"
    identity            = local.platform.identity_id
    key_vault_secret_id = local.platform.runtime_database_secret_id
  }
  template {
    container {
      name    = "retention"
      image   = var.image
      cpu     = 0.25
      memory  = "0.5Gi"
      command = ["python"]
      args    = ["-m", "app.maintenance"]
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
    }
  }
}
