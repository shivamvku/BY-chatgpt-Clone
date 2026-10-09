output "application" {
  value = {
    resource_group_name        = var.resource_group_name
    location                   = local.location
    name                       = var.name
    environment_id             = module.container_environment.id
    environment_domain         = module.container_environment.default_domain
    identity_id                = module.identity.id
    registry_server            = module.registry.login_server
    database_secret_id         = module.secrets.database_secret_id
    runtime_database_secret_id = module.secrets.runtime_database_secret_id
    migration_identity_id      = module.migration_identity.id
    azure_client_id            = module.identity.client_id
    llm_endpoint               = local.ai.enabled ? "${azurerm_cognitive_account.ai[0].endpoint}openai/v1" : ""
    llm_model                  = local.ai.enabled ? azurerm_cognitive_deployment.chat[0].name : ""
    tags                       = local.tags
  }
}
output "registry_name" { value = module.registry.name }
