# CI/CD Pipeline Architecture

This document details the continuous integration and deployment pipeline for YounderChat, including GitHub Actions workflows, Azure OIDC federation, and deployment automation.

## CI/CD Pipeline Overview

YounderChat uses a comprehensive CI/CD pipeline built on GitHub Actions with Azure OIDC federation, providing secure, automated deployments with comprehensive testing and validation.

```mermaid
graph TB
    subgraph "GitHub Repository"
        DEV["Developer<br/>git push"]
        PR["Pull Request<br/>Code Review"]
        MAIN["Main Branch<br/>Protected"]
    end

    subgraph "GitHub Actions - CI Pipeline"
        subgraph "Test Jobs (Parallel)"
            BACKEND["Backend Tests<br/>Ruff + pytest<br/>PostgreSQL service"]
            FRONTEND["Frontend Tests<br/>npm lint/test/build<br/>TypeScript + Vite"]
            BROWSER["Browser Tests<br/>Playwright + Chrome<br/>End-to-end scenarios"]
        end
        
        subgraph "Quality Gates"
            VALIDATE["Terraform Validation<br/>Format + Plan validation"]
            LINT["Code Quality<br/>ESLint + Ruff"]
        end
    end

    subgraph "GitHub OIDC Federation"
        OIDC_PROVIDER["GitHub OIDC Provider"]
        TOKEN_EXCHANGE["Token Exchange<br/>JWT → Azure AD Token"]
    end

    subgraph "Azure Active Directory"
        DEPLOY_IDENTITY["Deploy Identity<br/>Contributor + AcrPush"]
        PLAN_IDENTITY["Plan Identity<br/>Reader + Secrets User"]
    end

    subgraph "GitHub Actions - CD Pipeline"
        subgraph "Build Stage"
            DOCKER_BUILD["Docker Build<br/>Multi-stage build<br/>Frontend + Backend"]
            ACR_PUSH["Push to ACR<br/>Image tagging<br/>Digest capture"]
        end
        
        subgraph "Deploy Stage"
            TF_INIT["Terraform Init<br/>Remote state<br/>Provider setup"]
            MIGRATION["Database Migration<br/>Alembic migration job<br/>Private network"]
            APP_DEPLOY["Application Deploy<br/>Container App update<br/>Managed identity"]
        end
        
        subgraph "Verification Stage"
            SMOKE_TEST["Smoke Tests<br/>Health endpoints<br/>Basic functionality"]
            ROLLBACK["Rollback Capability<br/>Previous revision<br/>Health monitoring"]
        end
    end

    subgraph "Azure Container Platform"
        ACR["Container Registry<br/>Immutable images<br/>Geo-replication"]
        MIGRATION_JOB["Migration Job<br/>One-time execution<br/>VNet-integrated"]
        CONTAINER_APP["Container App<br/>Blue-green deployment<br/>Health monitoring"]
    end

    %% Developer workflow
    DEV --> PR
    PR --> MAIN

    %% CI triggers
    PR --> BACKEND
    PR --> FRONTEND
    PR --> VALIDATE
    MAIN --> BACKEND
    MAIN --> FRONTEND
    MAIN --> BROWSER

    %% Quality gates
    BACKEND --> LINT
    FRONTEND --> LINT
    VALIDATE --> LINT

    %% OIDC authentication
    LINT -.->|"Success triggers CD"| OIDC_PROVIDER
    OIDC_PROVIDER --> TOKEN_EXCHANGE
    TOKEN_EXCHANGE --> DEPLOY_IDENTITY
    TOKEN_EXCHANGE --> PLAN_IDENTITY

    %% CD pipeline flow
    DEPLOY_IDENTITY --> DOCKER_BUILD
    DOCKER_BUILD --> ACR_PUSH
    ACR_PUSH --> ACR
    
    ACR_PUSH --> TF_INIT
    TF_INIT --> MIGRATION
    MIGRATION --> MIGRATION_JOB
    MIGRATION_JOB --> APP_DEPLOY
    APP_DEPLOY --> CONTAINER_APP
    
    CONTAINER_APP --> SMOKE_TEST
    SMOKE_TEST -.->|"Failure"| ROLLBACK
    ROLLBACK -.-> CONTAINER_APP

    classDef ci fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef cd fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef azure fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class BACKEND,FRONTEND,BROWSER,VALIDATE,LINT ci
    class DOCKER_BUILD,ACR_PUSH,TF_INIT,MIGRATION,APP_DEPLOY,SMOKE_TEST cd
    class ACR,MIGRATION_JOB,CONTAINER_APP,DEPLOY_IDENTITY,PLAN_IDENTITY azure
```

## Workflow Configurations

### Application Workflow (`application.yml`)

| Trigger | Jobs Executed | Purpose |
|---------|---------------|---------|
| **Pull Request** | backend-tests, frontend-tests, browser-tests | Quality validation |
| **Push to main** | All CI jobs + Deploy | Production deployment |
| **Manual dispatch** | Configurable operations | On-demand operations |

### Infrastructure Workflow (`infrastructure.yml`)

| Trigger | Jobs Executed | Purpose |
|---------|---------------|---------|
| **PR (infra/ changes)** | Terraform validation only | Infrastructure validation |
| **Manual dispatch** | Terraform plan/apply | Infrastructure changes |

## CI/CD Stages Details

### Stage 1: Continuous Integration

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant CI as CI Jobs
    participant DB as Test Database

    Dev->>GH: git push / PR
    GH->>CI: Trigger workflows
    
    par Backend Testing
        CI->>DB: Start PostgreSQL service
        CI->>CI: Install Python deps
        CI->>CI: Run Ruff linter
        CI->>CI: Execute pytest
    and Frontend Testing
        CI->>CI: Install Node.js deps
        CI->>CI: Run ESLint + TypeScript
        CI->>CI: Execute unit tests
        CI->>CI: Build production bundle
    and Browser Testing
        CI->>DB: Start test database
        CI->>CI: Install Playwright
        CI->>CI: Run end-to-end tests
    end
    
    CI-->>GH: Test results
    GH-->>Dev: Status checks
```

### Stage 2: Authentication & Authorization

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant OIDC as GitHub OIDC
    participant AAD as Azure AD
    participant Azure as Azure Services

    Note over GH: CI tests passed, deploying...
    GH->>OIDC: Request OIDC token
    OIDC-->>GH: Signed JWT token
    
    GH->>AAD: Present JWT + identity claims
    Note over GH,AAD: Subject: repo:owner/repo:ref:refs/heads/main
    AAD->>AAD: Validate token signature & claims
    AAD-->>GH: Azure AD access token
    
    GH->>Azure: API calls with access token
    Azure->>Azure: Validate token & RBAC
    Azure-->>GH: Authorized operations
```

### Stage 3: Build & Registry

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant Docker as Docker Build
    participant ACR as Container Registry

    GH->>Docker: docker build (multi-stage)
    Note over Docker: Stage 1: Frontend build (Node.js)
    Note over Docker: Stage 2: Backend setup (Python)
    Note over Docker: Stage 3: Runtime image (distroless)
    Docker-->>GH: Built image

    GH->>ACR: docker push with tags
    Note over GH,ACR: Tags: latest, commit-sha, build-number
    ACR-->>GH: Image digest
    Note over GH: Capture digest for immutable deployment
```

### Stage 4: Database Migration

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant TF as Terraform
    participant JOB as Migration Job
    participant DB as PostgreSQL

    GH->>TF: terraform apply (migration job)
    TF->>JOB: Deploy migration container
    Note over JOB: VNet-integrated job
    Note over JOB: Uses migration managed identity
    
    JOB->>DB: Connect via private network
    JOB->>DB: Run Alembic migrations
    DB-->>JOB: Migration results
    JOB-->>GH: Success/failure status
    
    Note over GH: Wait for migration completion
    Note over GH: Only proceed if migrations succeed
```

### Stage 5: Application Deployment

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant TF as Terraform
    participant CA as Container App
    participant Health as Health Check

    GH->>TF: terraform apply (application)
    TF->>CA: Update container app revision
    Note over CA: New revision with latest image
    Note over CA: Rolling deployment strategy
    
    CA->>CA: Start new revision
    CA->>Health: Health probe checks
    Health-->>CA: Health status
    
    alt Health checks pass
        CA->>CA: Route traffic to new revision
        CA-->>GH: Deployment success
    else Health checks fail
        CA->>CA: Keep previous revision active
        CA-->>GH: Deployment failure
    end
```

## OIDC Federation Configuration

### GitHub OIDC Setup

| Configuration | Value | Purpose |
|---------------|-------|---------|
| **Issuer URL** | `https://token.actions.githubusercontent.com` | GitHub's OIDC provider |
| **Audience** | `api://AzureADTokenExchange` | Azure-specific audience claim |
| **Subject Claim** | `repo:{owner}/{repo}:ref:refs/heads/main` | Repository and branch identification |
| **Thumbprint** | GitHub's certificate thumbprint | Trust verification |

### Azure AD Application Configuration

| Setting | Value | Security Benefit |
|---------|-------|------------------|
| **Application Type** | Service Principal | Automated access without user credentials |
| **Credential Type** | Federated credential | No stored secrets |
| **Issuer** | GitHub OIDC | Trusted external identity provider |
| **Subject Identifier** | Repository-specific | Scoped access per repository |

## Environment Configuration

### CI/CD Environment Variables

```mermaid
graph TB
    subgraph "GitHub Repository Variables"
        AZURE_TENANT["AZURE_TENANT_ID"]
        AZURE_SUB["AZURE_SUBSCRIPTION_ID"]
        AZURE_RG["AZURE_RESOURCE_GROUP"]
        AZURE_APP["AZURE_APP_NAME"]
        DEPLOY_ID["AZURE_DEPLOY_CLIENT_ID"]
        PLAN_ID["AZURE_PLAN_CLIENT_ID"]
    end
    
    subgraph "GitHub Repository Secrets"
        GEMINI_KEY["GEMINI_API_KEY"]
        GROQ_KEY["GROQ_API_KEY"]
        RESEND_KEY["RESEND_API_KEY"]
    end
    
    subgraph "Terraform State Variables"
        TF_RG["TF_STATE_RESOURCE_GROUP"]
        TF_SA["TF_STATE_STORAGE_ACCOUNT"]
    end
    
    subgraph "Runtime Environment"
        ARM_TENANT["ARM_TENANT_ID"]
        ARM_SUB["ARM_SUBSCRIPTION_ID"]
        ARM_CLIENT["ARM_CLIENT_ID"]
        ARM_OIDC["ARM_USE_OIDC=true"]
    end
    
    AZURE_TENANT --> ARM_TENANT
    AZURE_SUB --> ARM_SUB
    DEPLOY_ID --> ARM_CLIENT
    TF_RG --> ARM_TENANT
    TF_SA --> ARM_TENANT
```

### Environment Protection Rules

| Environment | Protection Rules | Approval Required |
|-------------|------------------|------------------|
| **infra-plan** | Branch protection | No (automated) |
| **infra-deploy** | Branch protection + Manual approval | Yes (infrastructure changes) |
| **production** | Branch protection + Required reviews | No (automated after CI) |

## Deployment Strategies

### Blue-Green Deployment Model

```mermaid
graph TB
    subgraph "Container App Revisions"
        OLD_REV["Previous Revision<br/>Stable version<br/>100% traffic"]
        NEW_REV["New Revision<br/>Latest deployment<br/>Health checking"]
    end
    
    subgraph "Traffic Management"
        TRAFFIC["Traffic Routing<br/>Gradual shift"]
        HEALTH["Health Monitoring<br/>Continuous checks"]
    end
    
    subgraph "Rollback Capability"
        ROLLBACK["Automatic Rollback<br/>Health failure trigger"]
        MANUAL["Manual Rollback<br/>Operator control"]
    end
    
    OLD_REV --> TRAFFIC
    NEW_REV --> HEALTH
    HEALTH --> TRAFFIC
    HEALTH -.->|"Failure"| ROLLBACK
    TRAFFIC -.->|"Manual"| MANUAL
    
    ROLLBACK --> OLD_REV
    MANUAL --> OLD_REV
```

### Deployment Flow

1. **New Revision Creation**: Deploy new container image as inactive revision
2. **Health Verification**: Run health checks against new revision
3. **Traffic Shifting**: Gradually route traffic from old to new revision
4. **Monitoring**: Continuous health and performance monitoring
5. **Cleanup**: Deactivate old revision after successful deployment

## Monitoring and Observability

### Pipeline Monitoring

| Metric | Source | Alert Threshold | Action |
|--------|--------|-----------------|---------|
| **Build Success Rate** | GitHub Actions | < 95% | Investigate failing tests |
| **Deployment Duration** | Workflow timing | > 20 minutes | Optimize deployment process |
| **Test Coverage** | Test reports | < 80% | Improve test coverage |
| **Security Scan Results** | Code scanning | High/Critical findings | Fix security issues |

### Deployment Health Checks

```mermaid
sequenceDiagram
    participant Deploy as Deployment
    participant App as Container App
    participant Health as Health Endpoint
    participant Monitor as Monitoring

    Deploy->>App: Update revision
    App->>Health: Health probe
    Health-->>App: /api/health/ready status
    
    loop Every 30 seconds
        App->>Health: Readiness check
        Health-->>App: Health status
        App->>Monitor: Log health metrics
    end
    
    alt All checks pass
        App->>Deploy: Deployment success
    else Any check fails
        App->>Deploy: Deployment failure
        Deploy->>App: Rollback to previous
    end
```

## Security in CI/CD

### Secrets Management

| Secret Type | Storage Location | Access Scope | Rotation |
|-------------|------------------|--------------|----------|
| **Azure Service Principal** | Federated identity (no secret) | Workflow-scoped | N/A |
| **API Keys** | GitHub repository secrets | Deploy workflow only | Manual |
| **Database Passwords** | Azure Key Vault | Runtime/migration only | Manual |
| **Container Registry** | Managed identity | Push/pull operations | N/A |

### Security Scanning

```mermaid
graph TB
    subgraph "Security Checks"
        SAST["Static Analysis<br/>CodeQL + ESLint"]
        DEPS["Dependency Scanning<br/>npm audit + safety"]
        SECRETS["Secret Scanning<br/>GitHub native"]
        DOCKER["Container Scanning<br/>Trivy/Snyk"]
    end
    
    subgraph "Quality Gates"
        BLOCK["Block Deployment<br/>Critical/High findings"]
        WARN["Warning Status<br/>Medium findings"]
        PASS["Allow Deployment<br/>Low/Info findings"]
    end
    
    SAST --> BLOCK
    DEPS --> BLOCK
    SECRETS --> BLOCK
    DOCKER --> WARN
    
    BLOCK -.->|"Fix required"| SAST
    WARN --> PASS
    PASS --> DEPLOY["Deployment Approved"]
```

## Workflow Artifacts

### Build Artifacts

| Artifact | Purpose | Retention | Storage |
|----------|---------|-----------|---------|
| **Container Images** | Runtime deployment | 30 days | Azure Container Registry |
| **Test Reports** | Quality verification | 30 days | GitHub Actions |
| **Terraform Plans** | Infrastructure changes | 7 days | Workflow artifacts |
| **Security Scan Results** | Compliance evidence | 90 days | GitHub Security |

### Deployment Evidence

| Evidence Type | Content | Purpose |
|---------------|---------|---------|
| **Deployment Logs** | Complete deployment process | Audit trail |
| **Health Check Results** | Post-deployment verification | Success validation |
| **Rollback Procedures** | Emergency response steps | Incident response |
| **Performance Metrics** | Deployment impact assessment | Optimization |

---

*Content was rephrased for compliance with licensing restrictions*

For complete architecture, see [Azure Infrastructure](azure-infrastructure.md)  
For security details, see [Security Architecture](security-architecture.md)  
For network configuration, see [Network Topology](network-topology.md)