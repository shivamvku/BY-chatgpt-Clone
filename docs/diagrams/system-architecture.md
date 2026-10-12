# System Architecture

The application is a browser-based React/TypeScript client backed by FastAPI. Generation and provider integration are server-side; production persistence uses private PostgreSQL. Local review mode substitutes SQLite and does not access cloud resources.

~~~mermaid
flowchart TB
  U[User] --> B[Browser: React + TypeScript + Material UI]
  B -->|HTTPS REST, cookie, CSRF header| API[FastAPI API]
  API --> AUTH[Session / RBAC / ownership checks]
  AUTH --> SVC[Domain services]
  SVC <--> DB[(SQLAlchemy persistence)]
  SVC --> GEN[Generation service]
  GEN --> POLICY[Provider/model policy]
  POLICY --> GEM[Gemini API]
  POLICY --> GROQ[Groq API]
  subgraph Azure Production
    ACA[Azure Container Apps]
    PG[(Azure Database for PostgreSQL)]
    KV[Key Vault]
    MI[Managed identity]
    ACR[Azure Container Registry]
    ACA <--> PG
    ACA -. identity / secret references .-> MI
    MI --> KV
    ACR --> ACA
  end
  API -. deployed runtime .-> ACA
  DB -. production backing store .-> PG
  subgraph Local Reviewer Mode
    SQLITE[(backend/local.db: SQLite)]
  end
  DB -. local configuration .-> SQLITE
  GH[GitHub Actions] --> OIDC[GitHub OIDC]
  OIDC --> AZ[Azure identity / deployment permissions]
  GH --> ACR
  GH --> TF[Terraform]
  TF --> ACA
  TF --> PG
~~~

## Main responsibilities

- **Browser:** presentation, interaction, local rendering and stream consumption; it is not a trusted authorization boundary.
- **FastAPI:** request validation, session authentication, authorization, CSRF/origin checks, orchestration and response contracts.
- **Domain services:** conversations, messages, usage reservations, generation lifecycle, history, admin and audit behaviors.
- **Provider abstraction:** model policy and provider adapters; credentials remain server-side.
- **Database:** durable users, sessions, conversations, messages, generations, usage and administrative records according to the current models/migrations.
- **Azure runtime:** ACA hosts the deployed application, ACR stores the container image, PostgreSQL stores durable state, and Key Vault/managed identity support secret access without baking secrets into images.
- **Delivery pipeline:** GitHub Actions runs validation and deploys with OIDC-based cloud identity; Terraform defines managed infrastructure.

## Trust boundaries

1. Browser to API: HTTPS, cookie session and CSRF/origin protection for mutations.
2. API to database: server-side database credentials and restricted runtime role.
3. API to LLM provider: outbound server-to-server calls with provider credentials held in the backend environment/secret store.
4. CI to Azure: OIDC federation and scoped permissions; avoid long-lived cloud secrets where the configured workflow supports federation.

This is a logical diagram. Exact Azure resource configuration must be verified in `infra/` and workflow YAML before changes.
