#!/usr/bin/env bash
set -euo pipefail
stack="${1:?stack required}"
case "$stack" in foundation|migrations|application) ;; *) echo "Invalid stack" >&2; exit 1;; esac
: "${TF_STATE_RESOURCE_GROUP:?}" "${TF_STATE_STORAGE_ACCOUNT:?}"
arguments=(
  "-chdir=infra/terraform/environments/dev/$stack"
  init -input=false -lockfile=readonly
  "-backend-config=resource_group_name=$TF_STATE_RESOURCE_GROUP"
  "-backend-config=storage_account_name=$TF_STATE_STORAGE_ACCOUNT"
  "-backend-config=container_name=tfstate"
  "-backend-config=key=dev/$stack.tfstate"
  "-backend-config=use_azuread_auth=true"
  "-backend-config=use_oidc=true"
)
terraform "${arguments[@]}"
