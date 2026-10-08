mock_provider "azurerm" {}

run "registry_matches_verified_allowance" {
  command = plan
  module { source = "../../../modules/registry" }
  variables {
    name                 = "bychattestregistry"
    location             = "centralus"
    resource_group_name  = "bychat-test-rg"
    tags                 = { managed_by = "terraform" }
    runtime_principal_id = "00000000-0000-0000-0000-000000000001"
    deploy_principal_id  = "00000000-0000-0000-0000-000000000002"
    sku                  = "Standard"
  }
  assert {
    condition     = azurerm_container_registry.this.sku == "Standard"
    error_message = "The selected free allowance applies to Standard registry units."
  }
  assert {
    condition     = !azurerm_container_registry.this.admin_enabled && !azurerm_container_registry.this.anonymous_pull_enabled
    error_message = "Registry admin passwords and anonymous pulls must remain disabled."
  }
}
