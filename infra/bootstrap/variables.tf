variable "subscription_id" {
  type = string
}
variable "location" {
  type = string
}
variable "name" {
  type = string
}
variable "github_repository" {
  type = string
}
variable "github_repository_subject" {
  description = "Optional immutable OIDC repository segment: OWNER@OWNER_ID/REPO@REPO_ID. Null preserves the legacy names-only format."
  type        = string
  default     = null
  validation {
    condition     = var.github_repository_subject == null ? true : can(regex("^[^/@:]+@[0-9]+/[^/@:]+@[0-9]+$", var.github_repository_subject))
    error_message = "Use the immutable OWNER@OWNER_ID/REPO@REPO_ID format without the repo: prefix."
  }
}
