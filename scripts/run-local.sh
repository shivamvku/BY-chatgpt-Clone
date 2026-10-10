#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v python3 >/dev/null || { echo "Python 3.12+ is required." >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 22+ is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
PYTHON="${PYTHON:-python3}"
"$PYTHON" -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ is required"'
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo "Node.js 22+ is required." >&2; exit 1; }
if [[ ! -d .venv ]]; then "$PYTHON" -m venv .venv; fi
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements-dev.lock
.venv/bin/python -m pip install --no-deps -e './backend[dev]'
if [[ ! -d frontend/node_modules ]]; then (cd frontend && npm ci); fi
export APP_ENV=development
export DATABASE_URL="sqlite:///./local.db"
export SKIP_EMAIL_VERIFICATION=true
export PUBLIC_URL="http://localhost:5173"
export ALLOWED_ORIGINS="http://localhost:5173,http://localhost:8000"
export SERVE_FRONTEND=false
(cd backend && ../.venv/bin/python -m app.local_setup)
backend_pid=""
frontend_pid=""
cleanup() {
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || wait "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || wait "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
(cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
backend_pid=$!
(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173) &
frontend_pid=$!
echo "YounderChat local demo:"
echo "  UI:       http://localhost:5173"
echo "  API docs: http://localhost:8000/api/docs"
echo "  Health:   http://localhost:8000/api/health/live"
echo "Admin: admin@younderchat.local / AdminDemo!2026"
echo "User:  user@younderchat.local  / UserDemo!2026"
echo "For real LLM responses, export GEMINI_API_KEY and/or GROQ_API_KEY before launch."
echo "Press Ctrl+C to stop both servers. SQLite data is stored in backend/local.db."
wait
