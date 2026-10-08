mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      object_id       = "11111111-1111-1111-1111-111111111111"
      tenant_id       = "22222222-2222-2222-2222-222222222222"
      subscription_id = "33333333-3333-3333-3333-333333333333"
    }
  }
}
mock_provider "random" {}

variables {
  subscription_id   = "33333333-3333-3333-3333-333333333333"
  location          = "centralus"
  name              = "bychat-test"
  github_repository = "example/chat"
}

run "immutable_repository_subject" {
  command = plan
  variables {
    github_repository_subject = "example@123/chat@456"
  }
  assert {
    condition     = azurerm_federated_identity_credential.ci["plan"].subject == "repo:example@123/chat@456:environment:infra-plan" && azurerm_federated_identity_credential.ci["deploy"].subject == "repo:example@123/chat@456:environment:infra-deploy"
    error_message = "Federation must include immutable repository IDs and the exact environment."
  }
}

run "legacy_repository_subject" {
  command = plan
  variables {
    github_repository_subject = null
  }
  assert {
    condition     = azurerm_federated_identity_credential.ci["plan"].subject == "repo:example/chat:environment:infra-plan"
    error_message = "Legacy repositories must retain the names-only subject when no immutable segment is configured."
  }
}
