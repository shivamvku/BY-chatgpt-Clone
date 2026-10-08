#!/usr/bin/env bash
set -euo pipefail
job="$(terraform -chdir=infra/terraform/environments/dev/migrations output -raw migration_job_name)"
execution="$(az containerapp job start --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --query name -o tsv)"
for attempt in $(seq 1 90); do
  status="$(az containerapp job execution show --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --job-execution-name "$execution" --query properties.status -o tsv)"
  case "$status" in
    Succeeded) exit 0;;
    Failed|Stopped|Canceled) echo "Migration failed: $status" >&2; exit 1;;
  esac
  sleep 5
done
echo 'Migration timed out' >&2
exit 1
