variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "vnet_name" { type = string }
variable "allowed_cidr" { type = string }
variable "public_key" { type = string }
variable "vm_size" { type = string }
variable "image_sku" {
  type    = string
  default = "22_04-lts-gen2"
}
variable "username" { type = string }
variable "shutdown_time" { type = string }
variable "shutdown_timezone" { type = string }
