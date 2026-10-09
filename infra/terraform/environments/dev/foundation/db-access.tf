module "db_access" {
  count               = local.db_access.enabled ? 1 : 0
  source              = "../../../modules/db-access"
  name                = var.name
  location            = local.location
  resource_group_name = var.resource_group_name
  tags                = local.tags
  vnet_name           = module.networking.vnet_name
  allowed_cidr        = var.db_access_cidr
  public_key          = var.db_access_public_key
  vm_size             = local.db_access.vm_size
  username            = local.db_access.ssh_username
  shutdown_time       = local.db_access.shutdown_time
  shutdown_timezone   = local.db_access.shutdown_timezone
}
output "database_access" {
  value = local.db_access.enabled ? {
    ssh_host        = module.db_access[0].ssh_host
    ssh_user        = local.db_access.ssh_username
    database_host   = module.database.fqdn
    database_name   = "chat"
    database_user   = "chat_observer"
    password_secret = "observer-database-url"
  } : null
}
