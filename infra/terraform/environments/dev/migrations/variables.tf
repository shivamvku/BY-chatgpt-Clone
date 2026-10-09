variable "subscription_id" {
  type = string
}
variable "release_commit" {
  type    = string
  default = ""
  validation {
    condition     = var.release_commit == "" || can(regex("^[a-f0-9]{40}$", var.release_commit))
    error_message = "Release commit must be a full Git SHA."
  }
}
variable "operation" {
  type    = string
  default = "migration-status"
  validation {
    condition     = contains(["migration-status", "promote-admin"], var.operation)
    error_message = "Only reviewed operator commands are supported."
  }
}
variable "operator_email" {
  type    = string
  default = ""
}
variable "operator_actor" {
  type    = string
  default = "operator"
  validation {
    condition     = var.operator_actor == "operator" || can(regex("^github:[0-9]{1,20}$", var.operator_actor))
    error_message = "Operator actor must be the authenticated GitHub account ID."
  }
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
