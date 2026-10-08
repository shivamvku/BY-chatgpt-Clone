mock_provider "azurerm" {}
mock_provider "azapi" {}
override_data {
  target = data.terraform_remote_state.foundation
  values = {
    outputs = {
      application = {
        name                = "bychat-test"
        resource_group_name = "bychat-test-rg"
        location            = "centralus"
        environment_id      = "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/bychat-test-rg/providers/Microsoft.App/managedEnvironments/bychat-test-environment"
        tags                = { managed_by = "terraform" }
      }
    }
  }
}
variables {
  subscription_id       = "11111111-1111-1111-1111-111111111111"
  state_resource_group  = "test-state-rg"
  state_storage_account = "teststateaccount"
}
run "configured_hostname_and_tls" {
  command = plan
  assert {
    condition     = azurerm_container_app_custom_domain.this.name == "aichat.sdigurukulam.in"
    error_message = "Only the agreed subdomain may be configured."
  }
  assert {
    condition     = azapi_resource.certificate.body.properties.domainControlValidation == "CNAME" && azapi_resource.certificate.body.properties.subjectName == azurerm_container_app_custom_domain.this.name
    error_message = "Managed certificate must validate the configured hostname through its direct CNAME."
  }
  assert {
    condition     = azapi_update_resource.binding.body.properties.configuration.ingress.customDomains[0].bindingType == "SniEnabled"
    error_message = "Custom-domain certificate binding must enable TLS."
  }
}
