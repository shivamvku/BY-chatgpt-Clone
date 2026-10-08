# aichat.sdigurukulam.in

The owner will add DNS records manually in GoDaddy. No GoDaddy API key or PAT is required. Azure hostname registration, managed certificate and TLS binding are managed through the separate Terraform `domains` root and the `Custom domain` GitHub workflow.

## Records to add

In the GoDaddy DNS zone for `sdigurukulam.in`, add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `aichat` | `bychat-dev.livelyflower-b2092c54.centralus.azurecontainerapps.io` | 600 seconds |
| TXT | `asuid.aichat` | `E3BAC3549F5FE235CEE4BB8F8E60F07FAC409D91C324CFD80B2347E831C4D5BC` | 600 seconds |

These are the live application's verified values, not credentials. GoDaddy appends the zone to the short record names. Regenerate values with `infra/pipelines/show-dns.py` if the app/environment is recreated. The CNAME must point directly to the app's Azure hostname for managed-certificate validation.

## Pipeline

1. Run `Custom domain` with `action=plan` and inspect the domain/certificate/binding plan.
2. Add the above records and wait for DNS propagation.
3. Run `Custom domain` with `action=apply`. The pipeline checks CNAME and TXT resolution before applying Terraform, then verifies frontend and readiness through HTTPS.

Domain policy lives in `infra/config/custom-domain.json`. State uses `dev/domains.tfstate`. The shared deployment concurrency group prevents overlap with application/foundation releases. Both Azure identities authenticate through OIDC; domain apply uses `infra-deploy`.

The pinned AzureRM provider does not expose managed-certificate creation, so the domains root uses the pinned Azure AzAPI provider for that resource and its binding. No Azure portal edits or ad hoc Azure creation commands are needed. AzureRM tracks hostname registration and ignores certificate fields owned by the managed-certificate binding, following its documented managed-certificate pattern.

The application remains an initial scaffold: its public health and frontend endpoints work, but authentication and chat are not implemented. Do not present this deployment as the completed assignment.

References: [Azure custom-domain requirements](https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates), [Azure certificate resource](https://learn.microsoft.com/en-us/azure/templates/microsoft.app/2025-07-01/managedenvironments/managedcertificates).
