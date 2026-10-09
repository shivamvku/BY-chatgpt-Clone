#!/usr/bin/env bash
set -euo pipefail
job="$(terraform -chdir=infra/terraform/environments/dev/migrations output -raw migration_job_name)"
bash infra/pipelines/run-job.sh "$job" app.db.migrate
