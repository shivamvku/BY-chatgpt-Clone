variable "subscription_id" {
  type = string
}
variable "db_access_cidr" {
  type    = string
  default = ""
  validation {
    condition     = var.db_access_cidr == "" || (can(cidrhost(var.db_access_cidr, 0)) && can(regex("^[0-9.]+/32$", var.db_access_cidr)))
    error_message = "Allow one operator IPv4 address using /32."
  }
}
variable "db_access_public_key" {
  type    = string
  default = ""
  validation {
    condition     = var.db_access_public_key == "" || can(regex("^ssh-(rsa|ed25519) [A-Za-z0-9+/=]+", var.db_access_public_key))
    error_message = "Supply an RSA or Ed25519 SSH public key, never a private key."
  }
}
variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
variable "resource_group_name" {
  type = string
}
variable "name" {
  type = string
}

variable "registry_sku" {
  type        = string
  description = "Standard matches the verified free-account registry allowance."
  default     = "Standard"
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.registry_sku)
    error_message = "Registry SKU must be Basic, Standard, or Premium."
  }
}
variable "deploy_principal_id" {
  type = string
}
variable "plan_principal_id" {
  type = string
}
variable "operator_principal_id" {
  type = string
}

variable "budget" {
  description = "Optional monthly resource-group budget; alerts do not cap spending."
  type        = object({ amount = number, email = string, start_date = string })
  default     = null
  validation {
    condition     = var.budget == null ? true : var.budget.amount > 0
    error_message = "Budget amount must be positive."
  }
}
