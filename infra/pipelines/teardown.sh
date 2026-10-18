#!/usr/bin/env bash
# Tear down the complete YounderChat Azure footprint.
# Read-only by default; destructive execution requires exact targets and confirmations.
set -euo pipefail

readonly EXPECTED_APP_RESOURCE_GROUP="bychat-dev-rg"
readonly EXPECTED_STATE_RESOURCE_GROUP="bychat-dev-tfstate-rg"
readonly EXPECTED_PROJECT_TAG="by-chat"

usage() {
  cat <<'EOF'
Usage: bash infra/pipelines/teardown.sh [--plan | --execute] \\
  --confirm-app <AZURE_APP_NAME> --backup-confirmed

Required environment variables:
  ARM_SUBSCRIPTION_ID, TEARDOWN_ALLOWED_SUBSCRIPTION_ID, AZURE_APP_NAME,
  AZURE_RESOURCE_GROUP, TF_STATE_RESOURCE_GROUP, TF_STATE_STORAGE_ACCOUNT

--plan is read-only and is the default. --execute permanently deletes the
application resource group first, then the Terraform state resource group.
The resource-group names are allowlisted in this script. Set TEARDOWN_ALLOWED_SUBSCRIPTION_ID\nto the independently verified subscription ID for this project; it must match ARM_SUBSCRIPTION_ID.
EOF
}

mode="plan"
confirm_app=""
backup_confirmed=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) mode="plan" ;;
    --execute) mode="execute" ;;
    --confirm-app)
      [[ $# -ge 2 && -n "$2" ]] || { echo "--confirm-app requires a value" >&2; exit 2; }
      confirm_app="$2"
      shift
      ;;
    --backup-confirmed) backup_confirmed=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

: "${ARM_SUBSCRIPTION_ID:?ARM_SUBSCRIPTION_ID is required}"
: "${TEARDOWN_ALLOWED_SUBSCRIPTION_ID:?Set TEARDOWN_ALLOWED_SUBSCRIPTION_ID to the verified project subscription ID}"
: "${AZURE_APP_NAME:?AZURE_APP_NAME is required}"
: "${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP is required}"
: "${TF_STATE_RESOURCE_GROUP:?TF_STATE_RESOURCE_GROUP is required}"
: "${TF_STATE_STORAGE_ACCOUNT:?TF_STATE_STORAGE_ACCOUNT is required}"

# Validate the configured targets before calling Azure or printing an inventory.
[[ "$AZURE_RESOURCE_GROUP" == "$EXPECTED_APP_RESOURCE_GROUP" ]] || {
  echo "Refusing: AZURE_RESOURCE_GROUP must be exactly $EXPECTED_APP_RESOURCE_GROUP" >&2
  exit 1
}
[[ "$TF_STATE_RESOURCE_GROUP" == "$EXPECTED_STATE_RESOURCE_GROUP" ]] || {
  echo "Refusing: TF_STATE_RESOURCE_GROUP must be exactly $EXPECTED_STATE_RESOURCE_GROUP" >&2
  exit 1
}
[[ "$AZURE_RESOURCE_GROUP" != "$TF_STATE_RESOURCE_GROUP" ]] || {
  echo "Application and state resource groups must be different" >&2
  exit 1
}

if [[ "$mode" == "execute" ]]; then
  [[ "$confirm_app" == "$AZURE_APP_NAME" ]] || {
    echo "--confirm-app must exactly match AZURE_APP_NAME" >&2
    exit 1
  }
  [[ "$backup_confirmed" == true ]] || {
    echo "--backup-confirmed is required after preserving data outside Azure" >&2
    exit 1
  }
fi

[[ "$ARM_SUBSCRIPTION_ID" == "$TEARDOWN_ALLOWED_SUBSCRIPTION_ID" ]] || {
  echo "Refusing: ARM_SUBSCRIPTION_ID does not match TEARDOWN_ALLOWED_SUBSCRIPTION_ID" >&2
  exit 1
}
active_subscription="$(az account show --query id -o tsv)"
[[ "$active_subscription" == "$TEARDOWN_ALLOWED_SUBSCRIPTION_ID" ]] || {
  echo "The active Azure subscription does not match the verified project subscription allowlist" >&2
  exit 1
}

verify_group() {
  local group="$1"
  local tag
  tag="$(az group show --name "$group" --query tags.project -o tsv)"
  [[ "$tag" == "$EXPECTED_PROJECT_TAG" ]] || {
    echo "Refusing: $group must have tag project=$EXPECTED_PROJECT_TAG (got: $tag)" >&2
    exit 1
  }
}

inventory_group() {
  local group="$1"
  echo "Resources in $group:"
  az resource list --resource-group "$group" \
    --query '[].{type:type,name:name,location:location}' -o table
}

# Confirm both groups are project-tagged, and ensure the state storage account
# is actually in the allowlisted state group (not just a matching account name).
verify_group "$AZURE_RESOURCE_GROUP"
verify_group "$TF_STATE_RESOURCE_GROUP"
state_account_id="$(az storage account show --name "$TF_STATE_STORAGE_ACCOUNT" \
  --resource-group "$TF_STATE_RESOURCE_GROUP" --query id -o tsv)"
[[ -n "$state_account_id" && "$state_account_id" != "None" ]] || {
  echo "Refusing: Terraform state storage account was not found in $TF_STATE_RESOURCE_GROUP" >&2
  exit 1
}
expected_state_prefix="/subscriptions/$ARM_SUBSCRIPTION_ID/resourceGroups/$EXPECTED_STATE_RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/"
[[ "${state_account_id,,}" == "${expected_state_prefix,,}"* ]] || {
  echo "Refusing: state storage account ID is outside the expected subscription/resource group" >&2
  exit 1
}

# Tagged project resources outside the two allowlisted groups are not silently
# ignored. Print them and stop; they require a separately reviewed cleanup.
external_tagged_resources="$(az resource list --tag "project=$EXPECTED_PROJECT_TAG" \
  --query '[].{resourceGroup:resourceGroup,id:id,name:name,type:type}' -o tsv)"
external_group_lines=""
if [[ -n "$external_tagged_resources" ]]; then
  while IFS=$'\t' read -r group _rest; do
    [[ -n "$group" ]] || continue
    if [[ "$group" != "$EXPECTED_APP_RESOURCE_GROUP" && "$group" != "$EXPECTED_STATE_RESOURCE_GROUP" ]]; then
      external_group_lines+="$group"$'\n'
    fi
  done <<< "$external_tagged_resources"
fi

if [[ "$mode" == "plan" ]]; then
  echo "Read-only Azure teardown inventory for $AZURE_APP_NAME"
  echo "Subscription: $ARM_SUBSCRIPTION_ID"
  inventory_group "$AZURE_RESOURCE_GROUP"
  inventory_group "$TF_STATE_RESOURCE_GROUP"
  echo "Terraform state storage account resource ID: $state_account_id"
  echo "Project-tagged resources across the subscription:"
  if [[ -n "$external_tagged_resources" ]]; then
    printf '%s\n' "$external_tagged_resources"
  else
    echo "(none returned by Azure)"
  fi
  echo "Terraform state blob names (contents are never printed):"
  az storage blob list --auth-mode login --account-name "$TF_STATE_STORAGE_ACCOUNT" \
    --container-name tfstate --query '[].name' -o tsv
  if [[ -n "$external_group_lines" ]]; then
    echo "WARNING: tagged project resources exist outside the two target groups; execution is blocked until reviewed:" >&2
    printf '%s' "$external_group_lines" >&2
    exit 3
  fi
  cat <<'EOF'

No resources were changed. Review infra/docs/azure-rollback.md before executing.
This check covers project-tagged resources; manually inspect the full subscription
inventory for any untagged resources owned by this project before execution.
The execute path deletes the application group, waits, then deletes the state group.
EOF
  exit 0
fi

if [[ -n "$external_group_lines" ]]; then
  echo "Refusing execution: project-tagged resources exist outside the allowlisted groups; review and clean them separately first." >&2
  printf '%s' "$external_group_lines" >&2
  exit 3
fi

echo "Deleting application resource group: $AZURE_RESOURCE_GROUP"
az group delete --name "$AZURE_RESOURCE_GROUP" --yes --no-wait
az group wait --name "$AZURE_RESOURCE_GROUP" --deleted --timeout 3600

echo "Deleting Terraform state resource group: $TF_STATE_RESOURCE_GROUP"
az group delete --name "$TF_STATE_RESOURCE_GROUP" --yes --no-wait
az group wait --name "$TF_STATE_RESOURCE_GROUP" --deleted --timeout 3600

echo "Both Azure resource groups were deleted. Complete external cleanup and post-delete subscription inventory per infra/docs/azure-rollback.md."
