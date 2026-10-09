#!/usr/bin/env bash
set -euo pipefail
case "${1:?stack required}" in migrations|application) stack="$1";; *) exit 1;; esac
bash infra/pipelines/init-state.sh "$stack"
root="infra/terraform/environments/dev/$stack"
terraform -chdir="$root" plan -input=false -out=release.tfplan
terraform -chdir="$root" show -json release.tfplan | python3 infra/pipelines/guard-plan.py
terraform -chdir="$root" apply -input=false release.tfplan
rm -f "$root/release.tfplan"
if [[ "$stack" == migrations ]]; then
  bash infra/pipelines/migrate.sh
else
  url="$(terraform -chdir="$root" output -raw url)"
  printf 'url=%s\n' "$url" >> "$GITHUB_OUTPUT"
  printf '::notice title=Application live::%s\n' "$url"
fi
