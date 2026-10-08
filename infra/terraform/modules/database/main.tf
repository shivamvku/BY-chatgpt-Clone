resource "random_password" "administrator" {
  length  = 32
  special = false
}
resource "azurerm_postgresql_flexible_server" "this" {
  name                          = "${var.name}-pg"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = "16"
  delegated_subnet_id           = var.subnet_id
  private_dns_zone_id           = var.dns_zone_id
  public_network_access_enabled = false
  administrator_login           = "chatadmin"
  administrator_password        = random_password.administrator.result
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  tags                          = var.tags
  lifecycle {
    prevent_destroy = true
    # Azure assigns a zone when none is requested; preserve that placement.
    ignore_changes = [zone]
  }
}
resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = "chat"
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
output "connection_url" {
  value     = "postgresql+psycopg://chatadmin:${random_password.administrator.result}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/chat?sslmode=require"
  sensitive = true
}
