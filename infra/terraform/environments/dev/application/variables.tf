variable "subscription_id" {
  type = string
}
variable "state_resource_group" {
  type = string
}
variable "state_storage_account" {
  type = string
}
variable "image" {
  type = string
  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.image))
    error_message = "Use an immutable sha256 image digest, not a mutable tag."
  }
}
