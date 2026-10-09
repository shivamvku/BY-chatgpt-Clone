# YounderChat

React + Material UI and Python FastAPI with PostgreSQL persistence and Azure infrastructure managed through Terraform. See the implementation plan for branch validation, deployed status and remaining prerequisites.

See the [implementation plan](docs/implementation-plan.md), the single source of truth for goals, scope, status and acceptance criteria. Kiro coding guidance lives in [`.kiro/steering/`](.kiro/steering/), with shared product/engineering context and separate API, UI and infrastructure standards.

## Repository

- `frontend/`: TypeScript UI, Material UI theme and feature boundaries.
- `backend/`: API, configuration, database access, model/schema/service boundaries and Alembic.
- `infra/`: Terraform modules, environment roots, Docker, configuration examples and pipeline scripts.
- `.github/workflows/`: GitHub-required workflow entrypoints calling infrastructure scripts.

GitHub Actions has two workflows: **Infrastructure** and **Application**. Both preserve PR checks. Manual cloud stages run only from main. See [pipeline and database access setup](infra/README.md) and [Alembic tracking](backend/README.md#track-schema-changes).

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
python -m app.db.migrate
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
npm --prefix frontend run lint
npm --prefix frontend run test
terraform fmt -check -recursive infra
```

See [infrastructure setup](infra/README.md) for credential-free Terraform validation, network tests, bootstrap, planning and release instructions. Choose a region, review costs and inspect a saved plan before applying.

For browser tests, use an isolated development database, run migrations, start `python -m tests.browser_server` from `backend/`, and run `npm --prefix frontend run test:e2e` against Vite. This explicitly labelled test fixture never uses a real AI provider and is excluded from the Docker runtime. Normal development runs `uvicorn app.main:app` instead. Browser CI uses its own PostgreSQL service.

## Real model configuration

Set `GEMINI_API_KEY` for Gemini 2.5 Flash and `GROQ_API_KEY` for Groq's Llama 3.3 70B model. Basic accounts can use Gemini; Pro and Pro Max accounts can choose either model. Use `.env` only for local development. Production keys are GitHub secrets delivered through Terraform to Azure Key Vault and then referenced by the Container App managed identity. Never put provider credentials in frontend configuration.

Without a configured provider key, account and history functions remain available while that model is unavailable. Browser fixtures do not establish real inference verification.

To provision the initial administrator, register an account and run `python -m app.manage promote-admin --email YOUR_EMAIL` using trusted operator database access from an approved network. Public registration always creates a regular user. Email verification/reset remain unavailable until email-provider integration is configured.

## Screenshots

These actual UI screenshots use test accounts. Chat screenshots show the labelled deterministic browser fixture, not real Azure inference.

![Account screen](docs/screenshots/account-desktop.png)
![Chat workspace with test fixture](docs/screenshots/chat-desktop.png)

## Current boundaries

See the [implementation plan](docs/implementation-plan.md) for current capabilities and pending work. Development infrastructure trade-offs and deployment instructions are documented in the infrastructure guide.
