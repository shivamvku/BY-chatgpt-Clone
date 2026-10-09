#!/usr/bin/env bash
set -euo pipefail
case "${1:?operation required}" in
  start-db-access) command=start;;
  stop-db-access) command=deallocate;;
  *) exit 1;;
esac
az vm "$command" --name "${TF_VAR_name:?}-db-access" --resource-group "${AZURE_RESOURCE_GROUP:?}" --output none
# Power state is operational; resource configuration remains Terraform-managed.
