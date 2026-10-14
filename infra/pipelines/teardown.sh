#!/usr/bin/env bash
# Tear down the complete YounderChat Azure footprint. This script is intentionally
# inert by default: use --plan to inventory or --execute with both confirmations.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash infra/pipelines/teardown.sh [--plan | --execute] \
  --confirm-app <AZURE_APP_NAME> --backup-confirmed

Required environment variables:
  ARM_SUBSCRIPTION_ID, AZURE_APP_NAME, AZURE_RESOURCE_GROUP,
  TF_STATE_RESOURCE_GROUP, TF_STATE_STORAGE_ACCOUNT

--plan is read-only and is the default. --execute permanently deletes the
application resource group first, then the Terraform state resource group.
EOF
}

mode="plan"
confirm_app=""
backup_confirmed=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) mode="plan" ;;
    --execute) mode="execute" ;;
    --confirm-app) confirm_app="${2:?missing application name}"; shift ;;
    --backup-confirmed) backup_confirmed=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

: "${ARM_SUBSCRIPTION_ID:?}" "${AZURE_APP_NAME:?}" "${AZURE_RESOURCE_GROUP:?}"
: "${TF_STATE_RESOURCE_GROUP:?}" "${TF_STATE_STORAGE_ACCOUNT:?}"
[[ "$AZURE_RESOURCE_GROUP" != "$TF_STATE_RESOURCE_GROUP" ]] || {
  echo "Application and state resource groups must be different" >&2
  exit 1
}

az account show --query id -o tsv | grep -Fx "$ARM_SUBSCRIPTION_ID" >/dev/null || {
  echo "The active Azure subscription does not match ARM_SUBSCRIPTION_ID" >&2
  exit 1
}

verify_group() {
  local group="$1"
  [[ "$(az group show --name "$group" --query tags.project -o tsv)" == "by-chat" ]] || {
    echo "Refusing to delete $group: expected tag project=by-chat" >&2
    exit 1
  }
}

inventory_group() {
  local group="$1"
  echo "Resources in $group:"
  az resource list --resource-group "$group" --query '[].{type:type,name:name,location:location}' -o table
}

verify_group "$AZURE_RESOURCE_GROUP"
verify_group "$TF_STATE_RESOURCE_GROUP"

if [[ "$mode" == "plan" ]]; then
  echo "Read-only Azure teardown inventory for $AZURE_APP_NAME"
  inventory_group "$AZURE_RESOURCE_GROUP"
  inventory_group "$TF_STATE_RESOURCE_GROUP"
  echo "Terraform state blobs (contents are never printed):"
  az storage blob list --auth-mode login --account-name "$TF_STATE_STORAGE_ACCOUNT" \
    --container-name tfstate --query '[].name' -o tsv
  cat <<'EOF'

No resources were changed. Review infra/docs/azure-rollback.md before executing.
The execute path deletes the application resource group, waits for completion,
then deletes the state resource group and its Terraform state.
EOF
  exit 0
fi

[[ "$confirm_app" == "$AZURE_APP_NAME" ]] || {
  echo "--confirm-app must exactly match AZURE_APP_NAME" >&2
  exit 1
}
[[ "$backup_confirmed" == true ]] || {
  echo "--backup-confirmed is required after preserving data outside Azure" >&2
  exit 1
}

echo "Deleting application resource group: $AZURE_RESOURCE_GROUP"
az group delete --name "$AZURE_RESOURCE_GROUP" --yes --no-wait
az group wait --name "$AZURE_RESOURCE_GROUP" --deleted --timeout 3600

echo "Deleting Terraform state resource group: $TF_STATE_RESOURCE_GROUP"
az group delete --name "$TF_STATE_RESOURCE_GROUP" --yes --no-wait
az group wait --name "$TF_STATE_RESOURCE_GROUP" --deleted --timeout 3600

echo "Azure resource groups deleted. Complete the external cleanup in infra/docs/azure-rollback.md."
