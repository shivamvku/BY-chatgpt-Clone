resource "azurerm_container_app_job" "migrations" {
  name                         = "${var.name}-migrate"
  location                     = var.location
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.environment_id
  replica_timeout_in_seconds   = 300
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
      name    = "migration"
      image   = var.image
      cpu     = 0.5
      memory  = "1Gi"
      command = ["python"]
      args    = ["-m", "app.db.migrate"]
      env {
        name  = "RELEASE_COMMIT"
        value = var.release_commit
      }
      env {
        name  = "RELEASE_IMAGE"
        value = var.image
      }
      dynamic "env" {
        for_each = var.observer_secret_id == "" ? [] : [1]
        content {
          name        = "OBSERVER_DATABASE_URL"
          secret_name = "observer-database-url"
        }
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "RUNTIME_DATABASE_URL"
        secret_name = "runtime-database-url"
      }
    }
  }
  secret {
    name                = "runtime-database-url"
    identity            = var.identity_id
    key_vault_secret_id = var.runtime_database_secret_id
  }
  dynamic "secret" {
    for_each = var.observer_secret_id == "" ? [] : [var.observer_secret_id]
    content {
      name                = "observer-database-url"
      identity            = var.identity_id
      key_vault_secret_id = secret.value
    }
  }
}

output "name" { value = azurerm_container_app_job.migrations.name }
