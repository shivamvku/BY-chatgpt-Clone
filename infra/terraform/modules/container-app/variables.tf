variable "name" {
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
variable "app_config" { type = map(string) }
variable "resend_secret_id" {
  type    = string
  default = ""
}
variable "gemini_secret_id" {
  type    = string
  default = ""
}
variable "groq_secret_id" {
  type    = string
  default = ""
}
