#!/usr/bin/env bash
set -euo pipefail
bash infra/pipelines/init-state.sh "${STACK:?}"
root="infra/terraform/environments/dev/$STACK"
if [[ "${ACTION:-}" == *-db-access ]]; then
  az vm get-instance-view --name "${TF_VAR_name:?}-db-access" --resource-group "$AZURE_RESOURCE_GROUP" --query 'instanceView.statuses[].displayStatus' -o tsv
  exit 0
fi
if [[ "$STACK" == domains ]]; then
  url="$(terraform -chdir="$root" output -raw url)"
  curl --fail --silent --show-error --max-time 20 --retry 6 --retry-all-errors "$url/api/health/ready"
  curl --fail --silent --show-error --max-time 20 "$url/" >/dev/null
  printf '::notice title=Custom domain::%s\n' "$url"
else
  terraform -chdir="$root" output -raw registry_name
  echo 'Foundation applied. Database access requires the application migration stage before connecting.'
fi
