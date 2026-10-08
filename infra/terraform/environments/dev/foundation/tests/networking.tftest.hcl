mock_provider "azurerm" {}
run "private_database_network" {
  command = plan
  module { source = "../../../modules/networking" }
  variables {
    name                = "bychat-test"
    location            = "centralus"
    resource_group_name = "bychat-test-rg"
    tags                = { managed_by = "terraform" }
  }
  assert {
    condition     = azurerm_subnet.apps.address_prefixes == tolist(["10.42.0.0/23"])
    error_message = "Container Apps must have a dedicated non-overlapping subnet."
  }
  assert {
    condition     = azurerm_subnet.database.delegation[0].service_delegation[0].name == "Microsoft.DBforPostgreSQL/flexibleServers"
    error_message = "The database subnet must remain delegated to PostgreSQL."
  }
  assert {
    condition     = length([for rule in azurerm_network_security_group.database.security_rule : rule if rule.name == "DenyOtherInbound" && rule.access == "Deny" && rule.priority == 200]) == 1
    error_message = "Unapproved inbound database traffic must remain denied."
  }
  assert {
    condition     = length([for rule in azurerm_network_security_group.database.security_rule : rule if rule.name == "AllowAppPostgres" && rule.source_address_prefix == "10.42.0.0/23" && rule.destination_port_range == "5432"]) == 1
    error_message = "The application PostgreSQL rule must be scoped to the app subnet."
  }
}
