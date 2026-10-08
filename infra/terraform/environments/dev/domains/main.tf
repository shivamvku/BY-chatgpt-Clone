terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 4.41.0" }
    azapi   = { source = "Azure/azapi", version = "= 2.13.0" }
  }
  backend "azurerm" {}
}
provider "azurerm" {
  features {}
  subscription_id                 = var.subscription_id
  resource_provider_registrations = "none"
}
provider "azapi" { subscription_id = var.subscription_id }
variable "subscription_id" { type = string }
variable "state_resource_group" { type = string }
variable "state_storage_account" { type = string }

data "terraform_remote_state" "foundation" {
  backend = "azurerm"
  config = {
    resource_group_name  = var.state_resource_group
    storage_account_name = var.state_storage_account
    container_name       = "tfstate"
    key                  = "dev/foundation.tfstate"
    use_azuread_auth     = true
  }
}
locals {
  platform = data.terraform_remote_state.foundation.outputs.application
  config   = jsondecode(file("${path.module}/../../../../config/custom-domain.json"))
  hostname = "${local.config.subdomain}.${local.config.zone}"
  app_id   = "/subscriptions/${var.subscription_id}/resourceGroups/${local.platform.resource_group_name}/providers/Microsoft.App/containerApps/${local.platform.name}"
}
resource "azurerm_container_app_custom_domain" "this" {
  name             = local.hostname
  container_app_id = local.app_id
  lifecycle {
    ignore_changes = [certificate_binding_type, container_app_environment_certificate_id]
  }
}
resource "azapi_resource" "certificate" {
  type      = "Microsoft.App/managedEnvironments/managedCertificates@2025-07-01"
  name      = "aichat-managed-certificate"
  parent_id = local.platform.environment_id
  location  = local.platform.location
  tags      = local.platform.tags
  body = {
    properties = {
      subjectName             = local.hostname
      domainControlValidation = "CNAME"
    }
  }
  depends_on = [azurerm_container_app_custom_domain.this]
}
resource "azapi_update_resource" "binding" {
  type        = "Microsoft.App/containerApps@2025-07-01"
  resource_id = local.app_id
  body = {
    properties = {
      configuration = {
        ingress = {
          customDomains = [{ name = local.hostname, bindingType = "SniEnabled", certificateId = azapi_resource.certificate.id }]
        }
      }
    }
  }
}
output "url" { value = "https://${local.hostname}" }
