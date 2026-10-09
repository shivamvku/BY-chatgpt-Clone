mock_provider "azurerm" {}
run "explicit_operator_command" {
  command = plan
  module { source = "../../../modules/operator-job" }
  variables {
    name                = "test"
    location            = "centralus"
    resource_group_name = "test-rg"
    environment_id      = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.App/managedEnvironments/test"
    identity_id         = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/runtime"
    registry_server     = "test.azurecr.io"
    database_secret_id  = "https://test.vault.azure.net/secrets/runtime-database-url"
    image               = "test.azurecr.io/chat@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    tags                = {}
    operation           = "migration-status"
    operator_email      = ""
  }
  assert {
    condition     = azurerm_container_app_job.operator.template[0].container[0].args == tolist(["-m", "app.ops"])
    error_message = "Operator jobs must not silently execute migrations."
  }
  assert {
    condition     = endswith(one(azurerm_container_app_job.operator.secret).key_vault_secret_id, "/runtime-database-url")
    error_message = "Operator must use the runtime credential, not the database administrator."
  }
}
