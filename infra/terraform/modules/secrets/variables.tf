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
variable "tenant_id" {
  type = string
}
variable "deploy_principal_id" {
  type = string
}
variable "operator_principal_id" {
  type = string
}
variable "plan_principal_id" {
  type = string
}
variable "runtime_principal_id" {
  type = string
}
variable "database_url" {
  type      = string
  sensitive = true
}
variable "runtime_database_url" {
  type      = string
  sensitive = true
}
variable "migration_principal_id" { type = string }
variable "email_enabled" {
  type    = bool
  default = false
}
variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
