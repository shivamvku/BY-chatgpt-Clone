variable "name" {
  type = string
}
variable "observer_enabled" {
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
variable "subnet_id" {
  type = string
}
variable "dns_zone_id" {
  type = string
}
