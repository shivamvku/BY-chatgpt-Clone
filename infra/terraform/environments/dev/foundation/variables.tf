variable "subscription_id" {
  type = string
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
