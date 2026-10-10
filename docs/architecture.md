# YounderChat — System Architecture

The diagram shows the application boundaries used by the current implementation. The local interview launcher replaces PostgreSQL with SQLite and skips Azure/production access; the deployed architecture uses PostgreSQL and Azure resources.

~~~mermaid
flowchart TB
    Browser["Browser<br/>React + TypeScript + Material UI<br/>Chat, history, settings, admin"]
    API["FastAPI REST API<br/>Authentication, RBAC, ownership, validation"]
    Gen["Generation service<br/>SSE start / delta / done / error<br/>Stop, timeout, partial persistence"]
    Provider["Provider abstraction<br/>Canonical model IDs and plan policy"]
    DB[("Durable data<br/>Azure: private PostgreSQL<br/>Local: SQLite")]
    Gemini["Google Gemini API"]
    Groq["Groq API"]
    Browser -->|"HTTP + HttpOnly session cookie<br/>CSRF-protected mutations"| API
    API <--> DB
    API --> Gen
    Gen <--> DB
    Gen --> Provider
    Provider -->|"Server-side API key"| Gemini
    Provider -->|"Server-side API key"| Groq

    subgraph Delivery["Build and deployment"]
      Actions["GitHub Actions<br/>Frontend, backend, browser tests"]
      OIDC["GitHub OIDC"]
      Terraform["Terraform"]
      ACR["Azure Container Registry"]
      ACA["Azure Container Apps"]
      PG["Azure Database for PostgreSQL<br/>Private network"]
      KV["Azure Key Vault<br/>Managed identity / secret references"]
      Actions --> OIDC --> Terraform
      Actions --> ACR --> ACA
      Terraform --> ACA
      Terraform --> PG
      KV -. "runtime secret references" .-> ACA
    end
    ACA --> API
    API <--> PG
    DNS["GoDaddy DNS<br/>aichat.sdigurukulam.in"]
    DNS -. "demo hostname points to app endpoint" .-> ACA
    classDef client fill:#e8f1ff,stroke:#356ac3,color:#172b4d
    classDef service fill:#e9f7ef,stroke:#25855a,color:#153e2b
    classDef data fill:#fff4df,stroke:#b7791f,color:#563b10
    classDef external fill:#f3e8ff,stroke:#8250df,color:#38215c
    class Browser client
    class API,Gen,Provider service
    class DB,PG,KV data
    class Gemini,Groq,Actions,OIDC,Terraform,ACR,ACA,DNS external
~~~

## Request path

1. The browser calls FastAPI. Session cookies are HttpOnly; mutating requests are protected by origin and session-bound CSRF checks.
2. FastAPI validates the session, role, resource ownership, request limits and plan eligibility before accessing data or starting generation.
3. The generation service records the pending message and usage reservation, then streams normalized provider chunks through the API. Stop, timeout and provider errors become explicit generation states; partial output is persisted.
4. The provider abstraction selects Gemini or Groq using server-only credentials. Provider keys are never sent to the browser.
5. PostgreSQL is the deployed durable store. The local launcher uses a disposable SQLite file and seeds two demo accounts without Azure, Docker, production credentials or email integration.

## Azure delivery path

GitHub Actions validates pull requests. The production workflow uses OIDC and scoped identities, builds an immutable image, runs migrations in the private network, deploys to Azure Container Apps, then performs health checks. Terraform manages Azure resources. A successful CI run alone does not prove a live provider response or confirm which revision is currently deployed; verify those separately.

## DNS note

The demo hostname https://aichat.sdigurukulam.in/ uses the developer's personal domain registered/managed through GoDaddy and was set up specifically for this interview demonstration. It is a demonstration endpoint, not a Blue Yonder-owned domain.
