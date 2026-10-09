#!/usr/bin/env bash
set -euo pipefail
case "${STACK:?}" in foundation|domains) ;; *) echo 'Invalid stack' >&2; exit 1;; esac
case "${ACTION:?}" in
  start-db-access|stop-db-access)
    [[ "$STACK" == foundation ]] || { echo 'VM power operations require foundation' >&2; exit 1; }
    bash infra/pipelines/db-access-power.sh "$ACTION"
    exit 0;;
  plan|apply) ;;
  *) echo 'Invalid action' >&2; exit 1;;
esac
if [[ "$STACK" == foundation ]]; then
  export TF_VAR_budget="$(python3 infra/pipelines/configure-budget.py)"
  [[ -n "$TF_VAR_budget" ]] || { echo 'Budget policy could not be loaded' >&2; exit 1; }
  python3 infra/pipelines/check-ai.py
  python3 infra/pipelines/check-db-access.py
else
  python3 infra/pipelines/show-dns.py
  if [[ "$ACTION" == apply ]]; then bash infra/pipelines/wait-dns.sh; fi
fi
bash infra/pipelines/init-state.sh "$STACK"
root="infra/terraform/environments/dev/$STACK"
terraform -chdir="$root" plan -input=false -out=reviewed.tfplan
terraform -chdir="$root" show -json reviewed.tfplan | python3 infra/pipelines/guard-plan.py
if [[ "$ACTION" == apply ]]; then
  terraform -chdir="$root" apply -input=false reviewed.tfplan
fi
# Plans can contain secrets. They stay on this runner and are never uploaded.
rm -f "$root/reviewed.tfplan"
