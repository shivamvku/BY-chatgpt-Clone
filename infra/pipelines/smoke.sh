#!/usr/bin/env bash
set -euo pipefail
url="$(terraform -chdir=infra/terraform/environments/dev/application output -raw url)"
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 "$url/api/health/ready"
curl --fail --silent --show-error --retry 3 "$url/" >/dev/null
