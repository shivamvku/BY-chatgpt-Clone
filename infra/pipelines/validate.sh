#!/usr/bin/env bash
set -euo pipefail
terraform fmt -check -recursive infra
for root in infra/bootstrap infra/terraform/environments/dev/{foundation,migrations,application,domains}; do
  terraform -chdir="$root" init -backend=false -input=false -lockfile=readonly
  terraform -chdir="$root" validate
done
for root in infra/bootstrap infra/terraform/environments/dev/{foundation,domains}; do
  terraform -chdir="$root" test
done
