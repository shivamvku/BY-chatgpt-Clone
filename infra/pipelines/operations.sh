#!/usr/bin/env bash
set -euo pipefail
case "${OPERATION:?}" in promote-admin|migration-status) ;; *) exit 1;; esac
if [[ "$OPERATION" == promote-admin && -z "${OPERATOR_EMAIL:-}" ]]; then
  echo 'An existing verified admin email is required' >&2; exit 1
fi
bash infra/pipelines/init-state.sh migrations
# Release once first: the operator uses that already-tested immutable image.
export TF_VAR_image="$(terraform -chdir=infra/terraform/environments/dev/migrations output -raw release_image)"
export TF_VAR_release_commit="$(terraform -chdir=infra/terraform/environments/dev/migrations output -raw release_commit)"
export TF_VAR_operation="$OPERATION" TF_VAR_operator_email="${OPERATOR_EMAIL:-}"
export TF_VAR_operator_actor="github:${GITHUB_ACTOR_ID:?}"
root=infra/terraform/environments/dev/migrations
terraform -chdir="$root" plan -input=false -out=operator.tfplan
terraform -chdir="$root" show -json operator.tfplan | python3 infra/pipelines/guard-plan.py
terraform -chdir="$root" apply -input=false operator.tfplan
rm -f "$root/operator.tfplan"
job="$(terraform -chdir="$root" output -raw operator_job_name)"
bash infra/pipelines/run-job.sh "$job" app.ops
if [[ "$OPERATION" == promote-admin ]]; then
  echo 'Sign in again and confirm the Admin section to independently verify application access.'
fi
