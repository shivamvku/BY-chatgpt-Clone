resource "azurerm_container_app" "this" {
  name                         = var.name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.environment_id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = var.tags
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
  ingress {
    external_enabled           = true
    allow_insecure_connections = false
    target_port                = 8000
    transport                  = "http"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
  dynamic "secret" {
    for_each = var.resend_secret_id == "" ? [] : [var.resend_secret_id]
    content {
      name                = "resend-api-key"
      identity            = var.identity_id
      key_vault_secret_id = secret.value
    }
  }
  dynamic "secret" {
    for_each = var.gemini_secret_id == "" ? [] : [var.gemini_secret_id]
    content {
      name                = "gemini-api-key"
      identity            = var.identity_id
      key_vault_secret_id = secret.value
    }
  }
  dynamic "secret" {
    for_each = var.groq_secret_id == "" ? [] : [var.groq_secret_id]
    content {
      name                = "groq-api-key"
      identity            = var.identity_id
      key_vault_secret_id = secret.value
    }
  }
  template {
    min_replicas = 0
    max_replicas = 2
    container {
      name   = "app"
      image  = var.image
      cpu    = 0.5
      memory = "1Gi"
      dynamic "env" {
        for_each = var.app_config
        content {
          name  = upper(env.key)
          value = env.value
        }
      }
      dynamic "env" {
        for_each = var.gemini_secret_id == "" ? [] : [1]
        content {
          name        = "GEMINI_API_KEY"
          secret_name = "gemini-api-key"
        }
      }
      dynamic "env" {
        for_each = var.groq_secret_id == "" ? [] : [1]
        content {
          name        = "GROQ_API_KEY"
          secret_name = "groq-api-key"
        }
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      dynamic "env" {
        for_each = var.resend_secret_id == "" ? [] : [var.resend_secret_id]
        content {
          name        = "RESEND_API_KEY"
          secret_name = "resend-api-key"
        }
      }
      liveness_probe {
        transport        = "HTTP"
        port             = 8000
        path             = "/api/health/live"
        initial_delay    = 10
        interval_seconds = 30
      }
      readiness_probe {
        transport        = "HTTP"
        port             = 8000
        path             = "/api/health/ready"
        interval_seconds = 10
      }
      startup_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/api/health/live"
        interval_seconds        = 5
        failure_count_threshold = 30
      }
    }
  }
}
output "url" { value = "https://${azurerm_container_app.this.ingress[0].fqdn}" }
