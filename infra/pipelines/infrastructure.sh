#!/usr/bin/env bash
set -euo pipefail
case "${STACK:?}" in foundation|domains) ;; *) echo 'Invalid stack' >&2; exit 1;; esac
case "${ACTION:?}" in plan|apply) ;; *) echo 'Invalid action' >&2; exit 1;; esac
if [[ "$STACK" == foundation ]]; then
  python3 infra/pipelines/configure-budget.py
  python3 infra/pipelines/check-ai.py
  python3 infra/pipelines/check-db-access.py
else
  python3 infra/pipelines/show-dns.py
  if [[ "$ACTION" == apply ]]; then bash infra/pipelines/wait-dns.sh; fi
fi
bash infra/pipelines/init-state.sh "$STACK"
root="infra/terraform/environments/dev/$STACK"
terraform -chdir="$root" plan -input=false -out=reviewed.tfplan
if [[ "$ACTION" == apply ]]; then
  terraform -chdir="$root" apply -input=false reviewed.tfplan
fi
# Plans can contain secrets. They stay on this runner and are never uploaded.
rm -f "$root/reviewed.tfplan"
