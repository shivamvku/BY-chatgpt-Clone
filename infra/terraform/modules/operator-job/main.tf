resource "azurerm_container_app_job" "operator" {
  name                         = "${var.name}-operator"
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.environment_id
  replica_timeout_in_seconds   = 120
  replica_retry_limit          = 0
  workload_profile_name        = "Consumption"
  tags                         = var.tags
  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }
  identity {
    type         = "UserAssigned"
    identity_ids = [var.identity_id]
  }
  registry {
    server   = var.registry_server
    identity = var.identity_id
  }
  secret {
    name                = "database-url"
    identity            = var.identity_id
    key_vault_secret_id = var.database_secret_id
  }
  template {
    container {
      name    = "operator"
      image   = var.image
      cpu     = 0.25
      memory  = "0.5Gi"
      command = ["python"]
      args    = ["-m", "app.ops"]
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name  = "OPERATION"
        value = var.operation
      }
      env {
        name  = "OPERATOR_EMAIL"
        value = var.operator_email
      }
      env {
        name  = "OPERATOR_ACTOR"
        value = var.operator_actor
      }
    }
  }
  lifecycle {
    precondition {
      condition     = var.operation != "promote-admin" || can(regex("^[^@ ]+@[^@ ]+\\.[^@ ]+$", var.operator_email))
      error_message = "Admin promotion requires an existing verified email."
    }
  }
}
output "name" { value = azurerm_container_app_job.operator.name }
