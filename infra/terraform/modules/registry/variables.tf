variable "name" {
  type = string
}
variable "location" {
  type = string
}
variable "resource_group_name" {
  type = string
}
variable "tags" {
  type = map(string)
}
variable "runtime_principal_id" {
  type = string
}
variable "deploy_principal_id" {
  type = string
}

variable "sku" {
  type        = string
  description = "Select the registry SKU whose billing meter matches the account allowance."
  default     = "Basic"
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.sku)
    error_message = "Registry SKU must be Basic, Standard, or Premium."
  }
}
