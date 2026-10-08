---
inclusion: always
---
# Technology and engineering standards

- Frontend: React, TypeScript, Vite, Material UI; TanStack Query for server state and Zustand for small shared UI state.
- Backend: Python 3.12+, FastAPI, Pydantic settings, SQLAlchemy, psycopg and Alembic; PostgreSQL for persistence.
- Hosting: Azure Container Apps, Container Registry, Key Vault and private PostgreSQL Flexible Server; Terraform and GitHub Actions with Azure OIDC.
- Local development: Docker Desktop with WSL 2, Compose and PowerShell. Read repository manifests and lockfiles for exact versions; do not upgrade dependencies incidentally.

Use small cohesive modules, explicit types, descriptive names and dependency injection where it clarifies boundaries. Avoid speculative abstractions and unrelated rewrites. Inspect existing code before adding a competing pattern. Keep comments focused on intent and tradeoffs.

Never commit credentials, tokens, real `.env` files, Terraform state, plans, generated backend configuration or build output. Provide sanitized examples and maintain lockfiles. Never log secrets or private chat content. Treat model output and uploaded content as untrusted input.

Run checks appropriate to the change: Ruff and pytest for backend behavior, TypeScript/Vite build for UI, and Terraform formatting, validation and relevant policy tests for infrastructure. Add meaningful tests for authorization, persistence, streaming and failure behavior; avoid tests that merely repeat implementation. Report checks actually run and any remaining limitations.

Keep documentation synchronized with changed commands, contracts and deployment behavior. Continue authorized reversible work without repeated confirmation; use the user's existing authorization for account actions and stop before destructive or external actions outside that scope.
