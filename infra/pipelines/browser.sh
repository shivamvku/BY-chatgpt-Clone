#!/usr/bin/env bash
set -euo pipefail
(cd backend && DATABASE_URL="$RUNTIME_DATABASE_URL" python -m tests.browser_server) > /tmp/younderchat-api.log 2>&1 &
api_pid=$!
(cd frontend && API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1) > /tmp/younderchat-ui.log 2>&1 &
ui_pid=$!
trap 'kill "$api_pid" "$ui_pid" 2>/dev/null || true' EXIT
ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://localhost:5173/api/health/ready; then ready=true; break; fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  echo 'Browser-test server did not become ready' >&2
  echo '--- API server log ---' >&2
  cat /tmp/younderchat-api.log >&2 || true
  echo '--- UI server log ---' >&2
  cat /tmp/younderchat-ui.log >&2 || true
  exit 1
fi
cd frontend
npm run test:e2e
