mock_provider "azurerm" {}
run "runtime_cannot_read_admin_secret" {
  command = plan
  module { source = "../../../modules/secrets" }
  variables {
    name                   = "test-kv"
    location               = "centralus"
    resource_group_name    = "test-rg"
    tags                   = {}
    tenant_id              = "00000000-0000-0000-0000-000000000001"
    deploy_principal_id    = "00000000-0000-0000-0000-000000000002"
    operator_principal_id  = "00000000-0000-0000-0000-000000000003"
    plan_principal_id      = "00000000-0000-0000-0000-000000000004"
    runtime_principal_id   = "00000000-0000-0000-0000-000000000005"
    migration_principal_id = "00000000-0000-0000-0000-000000000006"
    database_url           = "test-admin-url"
    runtime_database_url   = "test-runtime-url"
    gemini_api_key         = "test-gemini-key"
    groq_api_key           = "test-groq-key"
  }
  override_resource {
    override_during = plan
    target          = azurerm_key_vault.this
    values          = { id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.KeyVault/vaults/test-kv" }
  }
  assert {
    condition     = endswith(azurerm_role_assignment.runtime.scope, "/secrets/runtime-database-url")
    error_message = "Runtime identity must not read the administrator database secret."
  }
  assert {
    condition     = azurerm_role_assignment.migration.principal_id != azurerm_role_assignment.runtime.principal_id
    error_message = "Migration and web runtime identities must be distinct."
  }
  assert {
    condition     = endswith(azurerm_role_assignment.runtime_gemini[0].scope, "/secrets/gemini-api-key")
    error_message = "Gemini access must use a stable Key Vault secret path."
  }
  assert {
    condition     = endswith(azurerm_role_assignment.runtime_groq[0].scope, "/secrets/groq-api-key")
    error_message = "Groq access must use a stable Key Vault secret path."
  }
}
