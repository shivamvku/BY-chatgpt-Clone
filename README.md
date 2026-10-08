# YounderChat

React + Material UI and Python FastAPI scaffolds with Azure infrastructure managed through Terraform. This milestone provides deployment foundations and health endpoints. Authentication, conversation persistence and AI streaming are not implemented yet.

See the [implementation plan](docs/implementation-plan.md), the single source of truth for goals, scope, status and acceptance criteria. Kiro coding guidance lives in [`.kiro/steering/`](.kiro/steering/), with shared product/engineering context and separate API, UI and infrastructure standards.

## Repository

- `frontend/`: TypeScript UI, Material UI theme and feature boundaries.
- `backend/`: API, configuration, database access, model/schema/service boundaries and Alembic.
- `infra/`: Terraform modules, environment roots, Docker, configuration examples and pipeline scripts.
- `.github/workflows/`: GitHub-required workflow entrypoints calling infrastructure scripts.

## Prerequisites

Python 3.12, Node.js 22, Docker Desktop with its Linux engine running, Terraform 1.13.5, Azure CLI and optionally GitHub CLI for scripted repository configuration. Azure resources are not needed for local development.

## Run with Docker

From the repository root:

```powershell
docker compose -f infra/docker/compose.yaml up --build
```

Open http://localhost:8000. Readiness is `/api/health/ready`. PostgreSQL uses a named volume. Compose exposes ports only on loopback; its password is local-development-only.

## Local development

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements-dev.lock
pip install --no-deps -e './backend[dev]'
docker compose -f infra/docker/compose.yaml up -d database
$env:DATABASE_URL = 'postgresql+psycopg://chat:local-development-only@localhost:25432/chat'
Set-Location backend
uvicorn app.main:app --reload
```

In another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to FastAPI. Local API docs are at http://localhost:8000/api/docs; production docs are disabled. `.env.example` documents configuration; set environment variables or place a local `.env` in the backend working directory. Never commit credentials.

## Checks

```powershell
.\.venv\Scripts\ruff.exe check backend
.\.venv\Scripts\python.exe -m pytest backend/tests
npm --prefix frontend run build
terraform fmt -check -recursive infra
```

See [infrastructure setup](infra/README.md) for credential-free Terraform validation, network tests, bootstrap, planning and release instructions. Choose a region, review costs and inspect a saved plan before applying.

## Current boundaries

See the [implementation plan](docs/implementation-plan.md) for current capabilities and pending work. Development infrastructure trade-offs and deployment instructions are documented in the infrastructure guide.
