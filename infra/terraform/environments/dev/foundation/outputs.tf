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
    observer_secret_id         = module.secrets.observer_secret_id
    resend_secret_id           = module.secrets.resend_secret_id
    gemini_secret_id           = module.secrets.gemini_secret_id
    groq_secret_id             = module.secrets.groq_secret_id
    migration_identity_id      = module.migration_identity.id
    tags                       = local.tags
  }
}
output "registry_name" { value = module.registry.name }
