#!/usr/bin/env bash
# Safety tests for teardown.sh. Azure CLI is fully mocked; no cloud calls are made.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEARDOWN="$ROOT/infra/pipelines/teardown.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
export MOCK_AZ_LOG="$tmp/az.log"
: > "$MOCK_AZ_LOG"

cat > "$tmp/bin/az" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_AZ_LOG"
case "$1 $2" in
  "account show")
    printf '%s\n' "${MOCK_SUBSCRIPTION_ID:-sub-123}"
    ;;
  "group exists")
    printf '%s\n' "${MOCK_APP_GROUP_EXISTS:-false}"
    ;;
  "group show")
    if [[ "${MOCK_BAD_TAG_GROUP:-}" == "$4" ]]; then
      printf '%s\n' "None"
    else
      printf '%s\n' "by-chat"
    fi
    ;;
  "storage account")
    if [[ "${MOCK_BAD_STATE_ACCOUNT:-false}" == true ]]; then
      printf '%s\n' "/subscriptions/sub-123/resourceGroups/other-rg/providers/Microsoft.Storage/storageAccounts/state123"
    else
      printf '%s\n' "/subscriptions/sub-123/resourceGroups/bychat-dev-tfstate-rg/providers/Microsoft.Storage/storageAccounts/state123"
    fi
    ;;
  "resource list")
    if [[ "${MOCK_EXTERNAL_TAGGED_RESOURCE:-false}" == true && " $* " == *" --tag "* ]]; then
      printf '%s\t%s\t%s\t%s\n' 'other-rg' '/resource/id' 'other-resource' 'Microsoft.Storage/storageAccounts'
    fi
    ;;
  "storage blob")
    ;;
  "group delete"|"group wait")
    ;;
  *)
    echo "Unexpected mocked az invocation: $*" >&2
    exit 99
    ;;
esac
MOCK
chmod +x "$tmp/bin/az"
export PATH="$tmp/bin:$PATH"

reset_log() { : > "$MOCK_AZ_LOG"; }
assert_no_delete() {
  if grep -Eq '^group delete ' "$MOCK_AZ_LOG"; then
    echo "FAIL: a rejection path invoked az group delete" >&2
    cat "$MOCK_AZ_LOG" >&2
    exit 1
  fi
}
expect_failure() {
  local label="$1"; shift
  if "$@" >"$tmp/output.log" 2>&1; then
    echo "FAIL: $label unexpectedly succeeded" >&2
    cat "$tmp/output.log" >&2
    exit 1
  fi
  assert_no_delete
  echo "PASS: $label"
}
run_teardown() {
  env ARM_SUBSCRIPTION_ID="sub-123" \
    TEARDOWN_ALLOWED_SUBSCRIPTION_ID="sub-123" \
    AZURE_APP_NAME="younderchat" \
    AZURE_RESOURCE_GROUP="bychat-dev-rg" \
    TF_STATE_RESOURCE_GROUP="bychat-dev-tfstate-rg" \
    TF_STATE_STORAGE_ACCOUNT="state123" \
    "$TEARDOWN" "$@"
}

# Plan is read-only.
reset_log
run_teardown --plan >"$tmp/output.log"
assert_no_delete
echo "PASS: plan mode performs no deletion"

# Exact resource-group allowlist is checked before any Azure CLI operation.
reset_log
expect_failure "wrong application resource group" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=other-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before target allowlist validation" >&2; exit 1; }

reset_log
expect_failure "wrong state resource group" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=other-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before target allowlist validation" >&2; exit 1; }

# Subscription allowlist and active subscription checks.
reset_log
expect_failure "wrong active subscription" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_SUBSCRIPTION_ID=wrong-sub PATH="$PATH" "$TEARDOWN" --plan

reset_log
expect_failure "subscription differs from explicit allowlist" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=other-sub AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before subscription allowlist validation" >&2; exit 1; }

# Missing tag and a state account outside the expected subscription/resource group fail closed.
reset_log
expect_failure "missing project tag" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_BAD_TAG_GROUP=bychat-dev-rg PATH="$PATH" "$TEARDOWN" --plan

reset_log
expect_failure "state account outside allowlist" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_BAD_STATE_ACCOUNT=true PATH="$PATH" "$TEARDOWN" --plan

# Application deletion requires both app confirmation and backup confirmation before Azure calls.
reset_log
expect_failure "missing application confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute-app --backup-confirmed
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before app execution confirmations" >&2; exit 1; }

reset_log
expect_failure "missing application backup confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute-app --confirm-app younderchat
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before app backup confirmation" >&2; exit 1; }

# State deletion has its own confirmation and is blocked while the app group exists.
reset_log
expect_failure "missing state group confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute-state --state-destruction-confirmed

reset_log
expect_failure "missing state destruction confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute-state --confirm-state-group bychat-dev-tfstate-rg
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before state destruction confirmation" >&2; exit 1; }

reset_log
expect_failure "state deletion blocked while app group exists" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_APP_GROUP_EXISTS=true PATH="$PATH" "$TEARDOWN" --execute-state --confirm-state-group bychat-dev-tfstate-rg --state-destruction-confirmed

# Tagged project resources outside the two groups block both phases.
reset_log
expect_failure "external tagged resource blocks plan" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_EXTERNAL_TAGGED_RESOURCE=true PATH="$PATH" "$TEARDOWN" --plan

reset_log
expect_failure "external tagged resource blocks app deletion" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_EXTERNAL_TAGGED_RESOURCE=true PATH="$PATH" "$TEARDOWN" --execute-app --confirm-app younderchat --backup-confirmed

reset_log
expect_failure "external tagged resource blocks state deletion" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_EXTERNAL_TAGGED_RESOURCE=true PATH="$PATH" "$TEARDOWN" --execute-state --confirm-state-group bychat-dev-tfstate-rg --state-destruction-confirmed

# Each successful destructive phase is mocked and can delete only its one target group.
reset_log
run_teardown --execute-app --confirm-app younderchat --backup-confirmed >"$tmp/output.log"
mapfile -t delete_calls < <(grep '^group delete ' "$MOCK_AZ_LOG")
[[ "${#delete_calls[@]}" -eq 1 && "${delete_calls[0]}" == "group delete --name bychat-dev-rg --yes --no-wait" ]] || { echo "FAIL: app phase must delete only the app group" >&2; cat "$MOCK_AZ_LOG" >&2; exit 1; }
echo "PASS: application phase deletes only the allowlisted app group"

reset_log
run_teardown --execute-state --confirm-state-group bychat-dev-tfstate-rg --state-destruction-confirmed >"$tmp/output.log"
mapfile -t delete_calls < <(grep '^group delete ' "$MOCK_AZ_LOG")
[[ "${#delete_calls[@]}" -eq 1 && "${delete_calls[0]}" == "group delete --name bychat-dev-tfstate-rg --yes --no-wait" ]] || { echo "FAIL: state phase must delete only the allowlisted state group" >&2; cat "$MOCK_AZ_LOG" >&2; exit 1; }
echo "PASS: separate state phase deletes only the allowlisted state group"

echo "All teardown safety tests passed."
