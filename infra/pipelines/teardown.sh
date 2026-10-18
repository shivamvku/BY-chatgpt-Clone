#!/usr/bin/env bash
# Retire the YounderChat Azure footprint in two separately reviewed phases.
# Read-only by default. Application and Terraform-state deletion are separate runs.
set -euo pipefail

readonly EXPECTED_SUBSCRIPTION_ID="2f5f1e55-f00a-4a6e-8b1d-39d87753d886"
readonly EXPECTED_APP_RESOURCE_GROUP="bychat-dev-rg"
readonly EXPECTED_STATE_RESOURCE_GROUP="bychat-dev-tfstate-rg"
readonly EXPECTED_PROJECT_TAG="by-chat"

usage() {
  cat <<'EOF'
Usage:
  bash infra/pipelines/teardown.sh --plan
  bash infra/pipelines/teardown.sh --execute-app \
    --confirm-app <AZURE_APP_NAME> --backup-confirmed
  bash infra/pipelines/teardown.sh --execute-state \
    --confirm-state-group bychat-dev-tfstate-rg --state-destruction-confirmed

Required environment variables:
  ARM_SUBSCRIPTION_ID, TEARDOWN_ALLOWED_SUBSCRIPTION_ID, AZURE_APP_NAME,
  AZURE_RESOURCE_GROUP, TF_STATE_RESOURCE_GROUP, TF_STATE_STORAGE_ACCOUNT

TEARDOWN_ALLOWED_SUBSCRIPTION_ID must be independently verified for this project
and must match ARM_SUBSCRIPTION_ID and the active Azure subscription.

--plan is read-only. --execute-app deletes only the application resource group.
After verifying that deletion and reviewing the remaining state inventory, run
--execute-state separately to delete the Terraform state resource group.
EOF
}

mode="plan"
confirm_app=""
backup_confirmed=false
confirm_state_group=""
state_destruction_confirmed=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) mode="plan" ;;
    --execute-app) mode="execute-app" ;;
    --execute-state) mode="execute-state" ;;
    --confirm-app)
      [[ $# -ge 2 && -n "$2" ]] || { echo "--confirm-app requires a value" >&2; exit 2; }
      confirm_app="$2"
      shift
      ;;
    --backup-confirmed) backup_confirmed=true ;;
    --confirm-state-group)
      [[ $# -ge 2 && -n "$2" ]] || { echo "--confirm-state-group requires a value" >&2; exit 2; }
      confirm_state_group="$2"
      shift
      ;;
    --state-destruction-confirmed) state_destruction_confirmed=true ;;
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

# Validate configured targets before calling Azure or printing an inventory.
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
[[ "$ARM_SUBSCRIPTION_ID" == "$EXPECTED_SUBSCRIPTION_ID" && "$TEARDOWN_ALLOWED_SUBSCRIPTION_ID" == "$EXPECTED_SUBSCRIPTION_ID" ]] || {
  echo "Refusing: both subscription variables must match the pinned project subscription allowlist" >&2
  exit 1
}

if [[ "$mode" == "execute-app" ]]; then
  [[ "$confirm_app" == "$AZURE_APP_NAME" ]] || {
    echo "--confirm-app must exactly match AZURE_APP_NAME" >&2
    exit 1
  }
  [[ "$backup_confirmed" == true ]] || {
    echo "--backup-confirmed is required after preserving required application data outside Azure" >&2
    exit 1
  }
fi

if [[ "$mode" == "execute-state" ]]; then
  [[ "$confirm_state_group" == "$EXPECTED_STATE_RESOURCE_GROUP" ]] || {
    echo "--confirm-state-group must exactly match $EXPECTED_STATE_RESOURCE_GROUP" >&2
    exit 1
  }
  [[ "$state_destruction_confirmed" == true ]] || {
    echo "--state-destruction-confirmed is required for the separate irreversible state deletion" >&2
    exit 1
  }
fi

active_subscription="$(az account show --query id -o tsv)"
[[ "$active_subscription" == "$EXPECTED_SUBSCRIPTION_ID" ]] || {
  echo "The active Azure subscription does not match the verified project subscription allowlist" >&2
  exit 1
}

app_group_exists="$(az group exists --name "$EXPECTED_APP_RESOURCE_GROUP" -o tsv)"
if [[ "$mode" == "execute-state" ]]; then
  [[ "$app_group_exists" == "false" ]] || {
    echo "Refusing to delete Terraform state while the application resource group still exists" >&2
    exit 1
  }
elif [[ "$mode" == "execute-app" ]]; then
  [[ "$app_group_exists" == "true" ]] || {
    echo "Refusing app deletion: the application resource group does not exist" >&2
    exit 1
  }
fi

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

verify_state_account() {
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
}

# Only project-tagged resources outside the two allowlisted groups are checked
# automatically. Untagged resources still require owner review of full inventory.
find_external_tagged_resources() {
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
  if [[ -n "$external_group_lines" ]]; then
    echo "Refusing: project-tagged resources exist outside the allowlisted groups; review and clean them separately first:" >&2
    printf '%s' "$external_group_lines" >&2
    exit 3
  fi
}

if [[ "$mode" != "execute-state" && "$app_group_exists" == "true" ]]; then
  verify_group "$AZURE_RESOURCE_GROUP"
fi
verify_group "$TF_STATE_RESOURCE_GROUP"
verify_state_account
find_external_tagged_resources

if [[ "$mode" == "plan" ]]; then
  echo "Read-only Azure retirement inventory for $AZURE_APP_NAME"
  echo "Subscription: $ARM_SUBSCRIPTION_ID"
  if [[ "$app_group_exists" == "true" ]]; then
    inventory_group "$AZURE_RESOURCE_GROUP"
  else
    echo "Application resource group $AZURE_RESOURCE_GROUP is already absent."
  fi
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
  cat <<'EOF'

No resources were changed. This tag query does not prove that no untagged
resources exist. Review the full subscription inventory and backups before
execution. Application and Terraform-state deletion are separate operations.
EOF
  exit 0
fi

if [[ "$mode" == "execute-app" ]]; then
  echo "Deleting application resource group only: $AZURE_RESOURCE_GROUP"
  az group delete --name "$AZURE_RESOURCE_GROUP" --yes --no-wait
  az group wait --name "$AZURE_RESOURCE_GROUP" --deleted --timeout 3600
  echo "Application resource group deleted. STOP: verify its absence, review the remaining state inventory, then run --plan again."
  echo "Terraform state has NOT been deleted. A separate --execute-state invocation is required."
  exit 0
fi

# --execute-state reaches here only after the application group is confirmed absent,
# and requires its own exact group name and explicit state-destruction confirmation.
echo "Deleting Terraform state resource group as a separate final operation: $TF_STATE_RESOURCE_GROUP"
az storage blob list --auth-mode login --account-name "$TF_STATE_STORAGE_ACCOUNT" \
  --container-name tfstate --query '[].name' -o tsv
az group delete --name "$TF_STATE_RESOURCE_GROUP" --yes --no-wait
az group wait --name "$TF_STATE_RESOURCE_GROUP" --deleted --timeout 3600
echo "Terraform state resource group deleted. Complete external cleanup and post-delete subscription inventory per infra/docs/azure-rollback.md."
