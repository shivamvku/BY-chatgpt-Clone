#!/usr/bin/env bash
set -euo pipefail
job="${1:?job required}"
module="${2:?Python module required}"
# Verify the persisted command. No command overrides are used or trusted.
spec="$(az containerapp job show --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --query 'properties.template.containers[0]' -o json)"
JOB_SPEC="$spec" python3 infra/pipelines/verify-job.py "$module"
execution="$(az containerapp job start --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --query name -o tsv)"
printf 'Started %s execution %s\n' "$job" "$execution"
for attempt in $(seq 1 90); do
  status="$(az containerapp job execution show --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --job-execution-name "$execution" --query properties.status -o tsv)"
  case "$status" in
    Succeeded)
      printf 'Verified job command completed: %s\n' "$execution"
      container=migration
      [[ "$module" != app.ops ]] || container=operator
      az containerapp job logs show --name "$job" --resource-group "$AZURE_RESOURCE_GROUP" --execution "$execution" --container "$container" --tail 100 --format text || echo 'Live logs expired; inspect persisted Log Analytics logs and schema_migrations.'
      exit 0;;
    Failed|Stopped|Canceled) echo "Job failed: $status" >&2; exit 1;;
  esac
  sleep 5
done
echo 'Job timed out' >&2
exit 1
