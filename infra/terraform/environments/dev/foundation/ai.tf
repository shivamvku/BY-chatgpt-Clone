locals { ai = jsondecode(file("${path.module}/../../../../config/ai.json")) }
resource "azurerm_cognitive_account" "ai" {
  count                 = local.ai.enabled ? 1 : 0
  name                  = "${var.name}-ai-${random_string.suffix.result}"
  location              = local.ai.location
  resource_group_name   = var.resource_group_name
  kind                  = "OpenAI"
  sku_name              = "S0"
  custom_subdomain_name = "${var.name}-ai-${random_string.suffix.result}"
  local_auth_enabled    = false
  tags                  = local.tags
}
resource "azurerm_cognitive_deployment" "chat" {
  count                = local.ai.enabled ? 1 : 0
  name                 = "younderchat-mini"
  cognitive_account_id = azurerm_cognitive_account.ai[0].id
  model {
    format  = "OpenAI"
    name    = local.ai.model
    version = local.ai.version
  }
  sku {
    name     = local.ai.sku
    capacity = local.ai.capacity
  }
  version_upgrade_option = "NoAutoUpgrade"
}
resource "azurerm_role_assignment" "ai_runtime" {
  count                = local.ai.enabled ? 1 : 0
  scope                = azurerm_cognitive_account.ai[0].id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = module.identity.principal_id
}
