output "application" {
  value = {
    resource_group_name = var.resource_group_name
    location            = local.location
    name                = var.name
    environment_id      = module.container_environment.id
    identity_id         = module.identity.id
    registry_server     = module.registry.login_server
    database_secret_id  = module.secrets.database_secret_id
    tags                = local.tags
  }
}
output "registry_name" { value = module.registry.name }
