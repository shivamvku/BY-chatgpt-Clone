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
    AZURE_APP_NAME="${AZURE_APP_NAME:-younderchat}" \
    AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-bychat-dev-rg}" \
    TF_STATE_RESOURCE_GROUP="${TF_STATE_RESOURCE_GROUP:-bychat-dev-tfstate-rg}" \
    TF_STATE_STORAGE_ACCOUNT="${TF_STATE_STORAGE_ACCOUNT:-state123}" \
    "$TEARDOWN" "$@"
}

# Valid plan is read-only.
reset_log
run_teardown --plan >"$tmp/output.log"
assert_no_delete
echo "PASS: plan mode performs no deletion"

# Exact allowlist must be checked before any Azure operation.
reset_log
expect_failure "wrong application resource group" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=other-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before target allowlist validation" >&2; exit 1; }

reset_log
expect_failure "wrong state resource group" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=other-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before target allowlist validation" >&2; exit 1; }

# Active subscription mismatch.
reset_log
expect_failure "wrong active subscription" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_SUBSCRIPTION_ID=wrong-sub PATH="$PATH" "$TEARDOWN" --plan

# Explicit project allowlist must match the deployment subscription variable.
reset_log
expect_failure "subscription differs from explicit allowlist" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=other-sub AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --plan
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before subscription allowlist validation" >&2; exit 1; }

# Missing project tag.
reset_log
expect_failure "missing project tag" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_BAD_TAG_GROUP=bychat-dev-rg PATH="$PATH" "$TEARDOWN" --plan

# State account must resolve inside the exact state resource group/subscription.
reset_log
expect_failure "state account outside allowlist" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_BAD_STATE_ACCOUNT=true PATH="$PATH" "$TEARDOWN" --plan

# Execution requires both confirmations before any Azure CLI call.
reset_log
expect_failure "missing application confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute --backup-confirmed
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before execution confirmations" >&2; exit 1; }

reset_log
expect_failure "missing backup confirmation" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 PATH="$PATH" "$TEARDOWN" --execute --confirm-app younderchat
[[ ! -s "$MOCK_AZ_LOG" ]] || { echo "FAIL: Azure CLI called before execution confirmations" >&2; exit 1; }

# A tagged project resource outside the target groups blocks both plan approval and execution.
reset_log
expect_failure "external tagged resource blocks plan" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_EXTERNAL_TAGGED_RESOURCE=true PATH="$PATH" "$TEARDOWN" --plan
assert_no_delete

reset_log
expect_failure "external tagged resource blocks execution" env ARM_SUBSCRIPTION_ID=sub-123 TEARDOWN_ALLOWED_SUBSCRIPTION_ID=sub-123 AZURE_APP_NAME=younderchat AZURE_RESOURCE_GROUP=bychat-dev-rg TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg TF_STATE_STORAGE_ACCOUNT=state123 MOCK_EXTERNAL_TAGGED_RESOURCE=true PATH="$PATH" "$TEARDOWN" --execute --confirm-app younderchat --backup-confirmed
assert_no_delete

# A fully confirmed execution in this test can only reach the mocked Azure CLI.
reset_log
run_teardown --execute --confirm-app younderchat --backup-confirmed >"$tmp/output.log"
mapfile -t delete_calls < <(grep '^group delete ' "$MOCK_AZ_LOG")
[[ "${#delete_calls[@]}" -eq 2 ]] || { echo "FAIL: expected exactly two mocked resource-group deletions" >&2; cat "$MOCK_AZ_LOG" >&2; exit 1; }
[[ "${delete_calls[0]}" == "group delete --name bychat-dev-rg --yes --no-wait" ]] || { echo "FAIL: application group must be deleted first" >&2; cat "$MOCK_AZ_LOG" >&2; exit 1; }
[[ "${delete_calls[1]}" == "group delete --name bychat-dev-tfstate-rg --yes --no-wait" ]] || { echo "FAIL: state group must be deleted last" >&2; cat "$MOCK_AZ_LOG" >&2; exit 1; }
echo "PASS: confirmed execution targets only the two allowlisted groups, in order"

echo "All teardown safety tests passed."
