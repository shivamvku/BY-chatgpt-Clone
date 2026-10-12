# Network Topology Architecture

This document details the network architecture of YounderChat's Azure deployment, including virtual network design, subnet configuration, network security groups, and private DNS resolution.

## Network Architecture Overview

The YounderChat application uses a hub-and-spoke network architecture within a single Virtual Network, with dedicated subnets for different service tiers and comprehensive network security controls.

```mermaid
graph TB
    subgraph "Internet"
        CLIENT["Client Browsers<br/>HTTPS Traffic"]
        GITHUB["GitHub Actions<br/>CI/CD Pipeline"]
    end

    subgraph "Azure Virtual Network - 10.42.0.0/16"
        subgraph "Container Apps Subnet - 10.42.0.0/23"
            direction TB
            CAE["Container App Environment<br/>Consumption Profile"]
            CA["Container App<br/>Public Ingress Enabled<br/>Port 8000 Internal"]
        end

        subgraph "Database Subnet - 10.42.2.0/24"
            direction TB
            PG["PostgreSQL Flexible Server<br/>Private Endpoint<br/>Port 5432"]
            NSG_DB["Network Security Group<br/>Database Protection"]
        end

        subgraph "Optional: Management Subnet - 10.42.3.0/24"
            direction TB
            VM["Database Access VM<br/>(When db_access.enabled)"]
        end

        subgraph "Private DNS Resolution"
            DNS_ZONE["Private DNS Zone<br/>*.postgres.database.azure.com"]
        end
    end

    subgraph "External Services"
        ACR["Azure Container Registry<br/>Private Access"]
        KV["Key Vault<br/>Private Access"]
        LA["Log Analytics<br/>HTTPS API"]
    end

    %% Traffic flows with protocols and ports
    CLIENT -->|"HTTPS/443"| CA
    CA -->|"Private/5432<br/>SSL Required"| PG
    CA -.->|"HTTPS/443<br/>Managed Identity"| KV
    CA -.->|"HTTPS/443<br/>Managed Identity"| ACR
    CA -->|"HTTPS/443<br/>Logs & Metrics"| LA

    %% CI/CD flows
    GITHUB -->|"HTTPS/443<br/>OIDC Auth"| ACR
    GITHUB -.->|"Azure CLI<br/>Container App Update"| CA

    %% Management access (optional)
    VM -.->|"TCP/5432<br/>SSH Tunnel"| PG

    %% Network security associations
    NSG_DB --> PG
    DNS_ZONE -.->|"Private Resolution"| PG

    %% Network boundaries
    classDef subnet fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef security fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#4a148c,stroke-width:2px

    class CAE,CA subnet
    class PG,NSG_DB subnet
    class VM subnet
    class DNS_ZONE security
    class ACR,KV,LA external
```

## Virtual Network Configuration

### Primary Virtual Network
- **Name**: `{name}-vnet`
- **Address Space**: `10.42.0.0/16` (65,536 addresses)
- **Region**: Central US
- **DNS Servers**: Azure-provided DNS with private DNS zone integration

### Subnet Allocation Strategy

| Subnet | CIDR Block | Available IPs | Service Delegation | Purpose |
|--------|------------|---------------|-------------------|---------|
| **container-apps** | `10.42.0.0/23` | 510 | Microsoft.App/environments | Container App Environment |
| **postgresql** | `10.42.2.0/24` | 254 | Microsoft.DBforPostgreSQL/flexibleServers | PostgreSQL Flexible Server |
| **management** | `10.42.3.0/24` | 254 | None | Optional database access VM |

*Note: Management subnet is created only when `db_access.enabled = true`*

## Network Security Groups

### Database Subnet NSG Rules

```mermaid
graph TD
    subgraph "Database NSG - {name}-db-nsg"
        RULE1["Priority 100: AllowAppPostgres<br/>Source: 10.42.0.0/23<br/>Destination: 10.42.2.0/24<br/>Protocol: TCP, Port: 5432<br/>Action: ALLOW"]
        
        RULE2["Priority 110: AllowPostgresInternal<br/>Source: 10.42.2.0/24<br/>Destination: 10.42.2.0/24<br/>Protocol: Any, Port: Any<br/>Action: ALLOW"]
        
        RULE3["Priority 120: AllowManagementPostgres<br/>Source: 10.42.3.0/24<br/>Destination: 10.42.2.0/24<br/>Protocol: TCP, Port: 5432<br/>Action: ALLOW<br/>(Conditional)"]
        
        RULE4["Priority 200: DenyOtherInbound<br/>Source: Any<br/>Destination: Any<br/>Protocol: Any, Port: Any<br/>Action: DENY"]
    end

    RULE1 --> RULE2 --> RULE3 --> RULE4
```

### NSG Rules Details

| Rule Name | Priority | Direction | Source | Destination | Protocol | Port | Action | Purpose |
|-----------|----------|-----------|--------|-------------|----------|------|--------|---------|
| AllowAppPostgres | 100 | Inbound | 10.42.0.0/23 | 10.42.2.0/24 | TCP | 5432 | Allow | Container App → PostgreSQL |
| AllowPostgresInternal | 110 | Inbound | 10.42.2.0/24 | 10.42.2.0/24 | * | * | Allow | Internal database communication |
| AllowManagementPostgres | 120 | Inbound | 10.42.3.0/24 | 10.42.2.0/24 | TCP | 5432 | Allow | Management VM → PostgreSQL (optional) |
| DenyOtherInbound | 200 | Inbound | * | * | * | * | Deny | Default deny all other traffic |

## Private DNS Configuration

### Private DNS Zone
- **Zone Name**: `{name}.postgres.database.azure.com`
- **Purpose**: Resolve PostgreSQL Flexible Server private endpoints
- **VNet Link**: Linked to main virtual network for resolution

### DNS Resolution Flow
1. Container App resolves PostgreSQL FQDN
2. Azure DNS queries private DNS zone
3. Private DNS zone returns private IP address
4. Connection established over private network

## Traffic Flow Analysis

### Inbound Traffic Flows

```mermaid
sequenceDiagram
    participant User as Internet User
    participant CA as Container App
    participant PG as PostgreSQL
    participant KV as Key Vault

    User->>CA: HTTPS/443 (Public Ingress)
    CA->>KV: HTTPS/443 (Secret Retrieval)
    Note over CA,KV: Managed Identity Authentication
    KV-->>CA: Database Connection String
    CA->>PG: TCP/5432 (Private Network)
    Note over CA,PG: SSL/TLS Required
    PG-->>CA: Query Results
    CA-->>User: HTTP Response
```

### Outbound Traffic Flows

```mermaid
sequenceDiagram
    participant CA as Container App
    participant ACR as Container Registry
    participant AI as AI Providers
    participant LA as Log Analytics

    Note over CA: Application Startup
    CA->>ACR: HTTPS/443 (Image Pull)
    Note over CA,ACR: Managed Identity (AcrPull)
    
    Note over CA: During Operation
    CA->>AI: HTTPS/443 (API Calls)
    Note over CA,AI: Server-side API Keys
    
    CA->>LA: HTTPS/443 (Logs & Metrics)
    Note over CA,LA: Built-in Integration
```

## IP Address Allocation

### Address Space Utilization

| Network Segment | CIDR | First IP | Last IP | Broadcast | Available | Used |
|-----------------|------|----------|---------|-----------|-----------|------|
| **VNet Total** | 10.42.0.0/16 | 10.42.0.0 | 10.42.255.255 | N/A | 65,536 | ~20 |
| **Container Apps** | 10.42.0.0/23 | 10.42.0.1 | 10.42.1.254 | 10.42.1.255 | 510 | ~5 |
| **Database** | 10.42.2.0/24 | 10.42.2.1 | 10.42.2.254 | 10.42.2.255 | 254 | ~5 |
| **Management** | 10.42.3.0/24 | 10.42.3.1 | 10.42.3.254 | 10.42.3.255 | 254 | ~2 |

*Note: Azure reserves the first 4 and last 1 IP addresses in each subnet*

## Service Endpoints and Private Links

### Service Integration

| Service | Connection Type | Network Path | Authentication |
|---------|----------------|--------------|----------------|
| **PostgreSQL** | Private Endpoint | 10.42.2.0/24 | SSL/TLS + Username/Password |
| **Key Vault** | Service Endpoint | Internet via Azure Backbone | Managed Identity |
| **Container Registry** | Service Endpoint | Internet via Azure Backbone | Managed Identity |
| **Log Analytics** | Public Endpoint | Internet | System-assigned Identity |

### Private Endpoint Configuration
- **PostgreSQL**: Deployed with private endpoint in database subnet
- **DNS Resolution**: Handled by private DNS zone
- **SSL/TLS**: Enforced for all database connections

## Network Monitoring and Troubleshooting

### Connectivity Testing

```bash
# From Container App to PostgreSQL (internal connectivity)
telnet {postgresql-fqdn} 5432

# DNS resolution test
nslookup {postgresql-fqdn}

# SSL certificate verification
openssl s_client -connect {postgresql-fqdn}:5432
```

### Common Network Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| **Database Connection Timeout** | App can't reach PostgreSQL | Check NSG rules, verify private DNS |
| **DNS Resolution Failure** | PostgreSQL FQDN not resolving | Verify private DNS zone VNet link |
| **SSL/TLS Handshake Failure** | Connection drops after TCP connect | Check PostgreSQL SSL configuration |
| **Managed Identity Access Denied** | 403 errors accessing Key Vault | Verify RBAC role assignments |

## Network Security Best Practices

### Implemented Security Controls
- **Private Database Access**: No public IP, private subnet only
- **Network Segmentation**: Dedicated subnets for different tiers
- **Principle of Least Privilege**: NSG rules allow only required traffic
- **SSL/TLS Encryption**: All database connections encrypted
- **Managed Identity**: Eliminates stored credentials

### Security Monitoring
- **NSG Flow Logs**: Can be enabled for security auditing
- **Azure Monitor**: Network performance and security metrics
- **Log Analytics**: Centralized logging for security events

---

*Content was rephrased for compliance with licensing restrictions*

For infrastructure overview, see [Azure Infrastructure](azure-infrastructure.md)  
For security architecture, see [Security Architecture](security-architecture.md)  
For complete system architecture, see [System Architecture](../architecture.md)