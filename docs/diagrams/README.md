# Azure Architecture Diagrams

Professional technical diagrams for YounderChat's Azure infrastructure, following Microsoft Azure documentation standards. All diagrams use Mermaid syntax for version control and maintainability.

## Infrastructure Diagrams

| Diagram | Description | Purpose |
|---------|-------------|---------|
| **[Azure Infrastructure](azure-infrastructure.md)** | Complete Azure services topology with configurations | Infrastructure planning, cost analysis, service relationships |
| **[Network Topology](network-topology.md)** | VNet design, subnets, security groups, and traffic flows | Network security, connectivity troubleshooting |
| **[Security Architecture](security-architecture.md)** | Identity management, RBAC, secrets, and compliance | Security auditing, compliance validation |

## Application Diagrams

| Diagram | Description | Purpose |
|---------|-------------|---------|
| **[Data Model](data-model.md)** | PostgreSQL schema, relationships, and performance patterns | Database design, query optimization |
| **[User Workflow](user-workflow.md)** | End-to-end user journey through Azure services | User experience, API design validation |

## Process Diagrams

| Diagram | Description | Purpose |
|---------|-------------|---------|
| **[CI/CD Pipeline](cicd-pipeline.md)** | GitHub Actions, OIDC federation, deployment automation | DevOps process, deployment troubleshooting |

## Legacy Diagrams (Preserved)

These diagrams remain for reference but are superseded by the Azure-specific diagrams above:

| Diagram | Description | Status |
|---------|-------------|---------|
| [System Architecture](system-architecture.md) | Logical system overview | ✅ Active - Referenced by main docs |
| [Auth Security](auth-security.md) | Authentication flow | ✅ Active - Detailed in Security Architecture |
| [Chat Streaming](chat-streaming.md) | Real-time chat implementation | ✅ Active - Detailed in User Workflow |
| [CI/CD Deployment](cicd-deployment.md) | Original deployment flow | 📋 Superseded by CI/CD Pipeline |

## Diagram Standards

### Azure Documentation Style
- **Service Grouping**: Azure services grouped within resource boundaries using Mermaid subgraphs
- **Security Boundaries**: VNet, subnets, and security zones clearly delineated
- **Data Flows**: Directional arrows with protocol and port labels
- **Professional Styling**: Consistent colors and styling matching Azure official documentation

### Mermaid Best Practices
- **Graph Types**: `graph TB` for architecture, `sequenceDiagram` for flows, `erDiagram` for data models
- **Node Naming**: Descriptive service names with configuration details
- **Color Coding**: Consistent color schemes across diagrams for service types
- **Validation**: All diagrams tested for renderability in GitHub and VS Code

### Content Standards
- **Actual Configurations**: Use real Azure resource names, SKUs, and CIDR blocks from Terraform
- **Security Sensitive**: No credentials or internal hostnames in diagrams
- **Compliance**: Content rephrased for licensing compliance where sourced externally
- **Maintenance**: Update diagrams in same PR as infrastructure changes

## Rendering Requirements

### GitHub Native Support
- All Mermaid diagrams render natively in GitHub without additional tools
- Diagrams tested in GitHub's Markdown preview

### Development Tools
- **VS Code**: Install Mermaid Preview extension for local editing
- **Validation**: Mermaid CLI can be used for syntax validation
- **Export**: Diagrams can be exported as SVG/PNG if needed for presentations

## Navigation and Cross-References

### Primary Architecture Flow
1. Start with **[System Architecture](../architecture.md)** for high-level overview
2. Review **[Azure Infrastructure](azure-infrastructure.md)** for complete service catalog
3. Deep-dive into specific areas:
   - Network design: **[Network Topology](network-topology.md)**
   - Security model: **[Security Architecture](security-architecture.md)**
   - User interactions: **[User Workflow](user-workflow.md)**
   - Data relationships: **[Data Model](data-model.md)**
   - Deployment process: **[CI/CD Pipeline](cicd-pipeline.md)**

### Cross-Reference Links
- Each diagram file includes links to related diagrams
- Main architecture document references all Azure-specific diagrams
- Implementation docs reference appropriate technical diagrams

---

*All Azure architectural diagrams follow Microsoft documentation standards and use actual infrastructure configurations from the Terraform codebase*