# Azure Architecture Diagrams

Professional Ultra-HD diagrams for YounderChat's Azure infrastructure with crystal-clear text and official Microsoft service icons.

## 🎨 Professional Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| **Azure Infrastructure** | [azure-infrastructure.md](azure-infrastructure.md) | Complete Azure services topology with configurations |
| **Network Topology** | [network-topology.md](network-topology.md) | VNet design, subnets, security groups, and traffic flows |
| **Security Architecture** | [security-architecture.md](security-architecture.md) | Identity management, RBAC, secrets, and compliance |
| **CI/CD Pipeline** | [cicd-pipeline.md](cicd-pipeline.md) | GitHub Actions, OIDC federation, deployment automation |
| **Data Model** | [data-model.md](data-model.md) | PostgreSQL schema, relationships, and performance patterns |
| **User Workflow** | [user-workflow.md](user-workflow.md) | End-to-end user journey through Azure services |

## 📊 Diagram Features

✅ **Ultra-HD Quality** - 300 DPI resolution with crystal-clear text  
✅ **Official Azure Icons** - Authentic Microsoft service representations  
✅ **Professional Styling** - Matching Azure documentation standards  
✅ **Enhanced Readability** - Large fonts, bold text, optimal spacing  
✅ **Color Coding** - Visual organization with cluster backgrounds  

## 🔧 Regenerating Diagrams

All diagrams are automatically generated using the professional diagram generation tool:

```bash
# Generate all diagrams in Ultra-HD
python tools/generate_all_diagrams.py --verbose

# Generate specific diagram
python tools/generate_all_diagrams.py --diagram azure-infrastructure
```

*Generated images are stored in [generated/](generated/) folder at Ultra-HD resolution for professional presentations.*