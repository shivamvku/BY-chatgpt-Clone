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
