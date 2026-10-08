#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_SHA:?}" "${GITHUB_ENV:?}"
registry="$(terraform -chdir=infra/terraform/environments/dev/foundation output -raw registry_name)"
server="$(az acr show --name "$registry" --query loginServer -o tsv)"
image="$server/by-chat:$GITHUB_SHA"
az acr login --name "$registry"
docker build --platform linux/amd64 --file infra/docker/Dockerfile --tag "$image" .
docker push "$image"
digest="$(az acr repository show --name "$registry" --image "by-chat:$GITHUB_SHA" --query digest -o tsv)"
if [[ ! "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo 'Registry returned an invalid image digest' >&2
  exit 1
fi
printf 'TF_VAR_image=%s/by-chat@%s\n' "$server" "$digest" >> "$GITHUB_ENV"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'image=%s/by-chat@%s\n' "$server" "$digest" >> "$GITHUB_OUTPUT"
fi
