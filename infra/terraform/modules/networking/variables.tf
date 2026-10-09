variable "name" {
  type = string
}
variable "management_enabled" {
  type    = bool
  default = false
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
