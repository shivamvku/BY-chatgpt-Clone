#!/usr/bin/env bash
set -euo pipefail
url="$(terraform -chdir=infra/terraform/environments/dev/application output -raw url)"
curl --fail --silent --show-error --connect-timeout 10 --max-time 30 --retry 12 --retry-all-errors --retry-delay 5 --retry-max-time 420 "$url/api/health/ready"
curl --fail --silent --show-error --connect-timeout 10 --max-time 30 --retry 3 --retry-all-errors --retry-max-time 120 "$url/" >/dev/null
