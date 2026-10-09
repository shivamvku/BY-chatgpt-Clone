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
variable "environment_id" {
  type = string
}
variable "identity_id" {
  type = string
}
variable "registry_server" {
  type = string
}
variable "database_secret_id" {
  type = string
}
variable "image" {
  type = string
}
variable "runtime_database_secret_id" { type = string }
variable "observer_secret_id" {
  type    = string
  default = ""
}
variable "release_commit" {
  type    = string
  default = ""
}
