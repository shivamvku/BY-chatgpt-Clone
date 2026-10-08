#!/usr/bin/env bash
set -euo pipefail
hostname=$(python3 -c 'import json; c=json.load(open("infra/config/custom-domain.json")); print(c["subdomain"]+"."+c["zone"])')
target=$(az containerapp show --name "$AZURE_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
verification=$(az containerapp show --name "$AZURE_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query properties.customDomainVerificationId -o tsv)
for attempt in $(seq 1 60); do
  cname=$(dig +short CNAME "$hostname" @1.1.1.1 | head -n 1)
  txt=$(dig +short TXT "asuid.$hostname" @1.1.1.1)
  if [[ "${cname%.}" == "$target" && "$txt" == "\"$verification\"" ]]; then
    echo 'CNAME and verification TXT propagated'
    exit 0
  fi
  sleep 10
done
echo 'DNS has not propagated yet; rerun once the configured records resolve' >&2
exit 1
