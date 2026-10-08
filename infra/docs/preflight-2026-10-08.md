# Azure preflight: 8 October 2026

Read-only CLI checks and retail pricing API queries. No infrastructure apply, resource creation, provider registration or GitHub configuration was performed during these checks.

## Account and permissions

- Subscription is enabled and uses the FreeTrial offer, with its spending limit on.
- The signed-in identity has Owner at subscription scope, sufficient for the proposed bootstrap and role assignments.
- Remaining trial credit, billing currency and account-specific free-service entitlements were not verified. Retail estimates below do not deduct credits or discounts.

## Regions and quotas

| Check | East US | East US 2 | Central US |
|---|---|---|---|
| PostgreSQL regional capability | Provisioning restricted | Subscription provisioning restricted | No restriction reason returned |
| Planned B1ms database SKU | Not available for provisioning under returned capabilities | Not available under returned capabilities | Listed |
| PostgreSQL version 16 | Restricted | Restricted | Listed |
| Container Apps environment slots | 1 allowed, 0 used | Not queried | 1 allowed, 0 used |

PostgreSQL restriction came from `az postgres flexible-server list-skus`; quotas came from `az containerapp list-usages`. A SKU listing is not a reservation or a guarantee of capacity at apply time. Environment-specific CPU quotas cannot be inspected before that environment exists.

Provider metadata lists East US and Central US support for all eight checked services: Container Apps, PostgreSQL, ACR, VNet, Storage, Key Vault, Managed Identity and Log Analytics. Generic regional support does not override the subscription-specific PostgreSQL restriction.

Network, Storage and Managed Identity providers are not registered. App, PostgreSQL, Container Registry, Key Vault and Operational Insights are registered. Use the repository provider-registration script before provisioning; its remaining prerequisites were not mutated during this audit.

## Bootstrap plan

Generated a saved East US bootstrap plan successfully: **15 additions, zero changes, zero deletions**. This includes two resource groups, one storage account, one blob container, two identities, two federated credentials, six role assignments and one local random-string resource.

The ignored plan is `infra/bootstrap/bootstrap-eastus.tfplan`; a readable capture is `.codex-tmp/bootstrap-plan.txt`. It is for review only. Do not apply it as an end-to-end deployment: the database remains region-blocked. Regenerate the plan after the region decision or any code/configuration change.

The live foundation plan requires the bootstrap resource group and identity outputs, so it cannot yet be fully evaluated against Azure without first applying bootstrap.

## Central US retail cost baseline

Retrieved current USD pay-as-you-go meters from the Azure Retail Prices API.

| Resource | Assumption | Monthly estimate |
|---|---|---:|
| PostgreSQL B1ms compute | 730 hours at USD 0.01921/hour | USD 14.02 |
| PostgreSQL storage | 32 GB at USD 0.13/GB-month | USD 4.16 |
| Basic Container Registry | 30 days at USD 0.1666/day | USD 5.00 |
| Fixed baseline subtotal | Before variable usage or account benefits | **USD 23.18** |

Additional costs include app/migration compute, state storage operations, vault operations, logs, build tasks beyond included allowances, backup overages and data transfer. AI usage is separate and no AI deployment is configured.

Container Apps grants 180,000 vCPU-seconds, 360,000 GiB-seconds and two million requests per subscription per month. At the configured 0.5 vCPU / 1 GiB allocation, 100 aggregate active replica-hours fit the compute grants, assuming no other apps/jobs consume them. Scaling to zero stops app resource consumption charges; it does not stop database or registry charges.

One replica active continuously for 730 hours would add approximately USD 34.02 in compute after those grants, using USD 0.000024/vCPU-second and USD 0.000003/GiB-second. That gives roughly USD 57.20 before other usage, not an upper spending limit.

Central US Log Analytics ingestion is USD 2.76/GB above the listed 5 GB free tier. Logging volume can materially change the total. Budget notifications require a chosen amount, contact email and billing currency; no budget has been configured.

Sources: [Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing).

## Next decision

Central US (`centralus`) was selected by the user after this audit. Configuration and the network test fixture now use that region. A new saved plan at `infra/bootstrap/bootstrap-centralus.tfplan` contains 15 additions, zero changes and zero deletions; its readable capture is `.codex-tmp/bootstrap-centralus-plan.txt`. The earlier East US plan is superseded and must not be applied. No apply was performed. Choose a budget alert amount in the subscription billing currency before deployment.

## Budget follow-up

The user selected 1,500/month, interpreted as INR based on location. The active Azure billing profile confirms INR. The repository policy now sets INR 1,500 with alerts at INR 1,200 and INR 1,500; no budget resource has been applied. The notification contact will be supplied through local ignored configuration or a GitHub variable.

Direct INR Retail Prices API meters for Central US are INR 1.844/hour for B1ms, INR 12.4786/GB-month for database storage, and INR 15.9918/day for Basic ACR. At 730 hours, 32 GB and 30 days, the fixed baseline is **INR 2,225.19/month**, before credits, free-service benefits, taxes and variable usage. This exceeds the requested budget. Verify eligible benefits or revise the architecture before deploying the full stack. An alert alone does not enforce the budget.

## Free-benefit and Docker follow-up

- Billing profile remains active, in INR, with spending limit on.
- Consumption credit balance-summary requests returned HTTP 404 (no dataset found), using both 2024-08-01 and 2026-06-01 versions. No remaining trial balance or expiry was verified.
- The Billing available-balance API returned no credit amount and zero payments on account. This is an invoice-credit/payment balance, not evidence that promotional trial credit is zero.
- Registered `Microsoft.BillingBenefits` through the repository setup script to query the supported `2025-12-01-preview` free-services endpoint. That endpoint returned an empty list. It did not confirm PostgreSQL benefit activation, and an empty resource list alone does not establish ineligibility for the traditional free-account allowance.
- Microsoft's current PostgreSQL product FAQ advertises up to 750 Burstable compute hours and 32 GB storage per month for 12 months with an eligible free account. Our B1ms/32 GB configuration is consistent with this offer, but account entitlement and remaining allowance are still unverified.
- If the database compute/storage allowance applies and remains available, the baseline would drop to approximately INR 479.75/month for Basic ACR, plus storage operations, logs, excess compute, builds, backup overages, tax and AI usage. This is a conditional scenario, not a verified total or a spending cap.
- Without that benefit, the retail baseline remains INR 2,225.19/month and does not fit INR 1,500/month for continuous operation.
- Opened Azure Portal for a final read-only check, but sign-in requires the user's passkey in a device security window. Portal credit/benefit verification remains pending that authentication step.
- `docker desktop start --timeout 30` failed to start the engine. Docker's backend log reports that Windows Subsystem for Linux is not installed. No OS feature installation, factory reset or reboot was performed. Docker image build remains unverified locally; hosted GitHub CI can validate it after an authorized repository push.

Microsoft notes that free-service usage can be delayed one to two days after resources are used. Check the subscription's free-services table and trial credit/expiry in the portal before relying on promotional pricing. No paid resources were created to test eligibility.

Sources: [PostgreSQL free-account FAQ](https://azure.microsoft.com/en-us/products/postgresql/), [Track free-service usage](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/check-free-service-usage), [Billing available-balance API](https://learn.microsoft.com/en-us/rest/api/billing/available-balances/get-by-billing-profile?view=rest-billing-2024-04-01).

## Verified portal allowances after sign-in

The subscription's **Free services for 12 months** table now confirms these unused monthly meters, all marked **Not in use**:

| Meter | Recorded usage / limit |
|---|---|
| PostgreSQL Flexible Server Burstable BS Series Compute, B1MS | 0 / 750 hours |
| PostgreSQL Flexible Server Storage, Data Stored | 0 / 32 GB-month |
| PostgreSQL Flexible Server Backup Storage, LRS Data Stored | 0 / 32 GB-month |
| Container Registry, Standard Registry Unit | 0 / 31 days |

The portal displays benefit expiry as **8 November 2027** and current subscription cost as **0.00**. These are observed portal values, not a guarantee of future cost or an independently verified remaining trial-credit amount. The earlier CLI-only uncertainty about these four allowance meters is resolved by the portal table.

Updated the development registry SKU to **Standard**, matching the verified registry allowance, while keeping the generic registry module configurable. Basic was the earlier estimate and would not match this Standard free meter. PostgreSQL remains B1ms with 32 GB storage and locally redundant backup.

Within the recorded free limits, PostgreSQL and the Standard registry's base meters can be covered by the allowances. The monthly total can still include app/migration compute beyond grants, logs, state operations, vault operations, transfer, build-task usage, backup overages and AI. Reassess costs and registry SKU before benefit expiry. The INR 1,500 notification remains an alert, not a hard cap.

Terraform schema validation and both mocked network/registry policy tests pass. No application infrastructure was applied.

The billing account Summary also shows amount due INR 0.00, no charges reported this month, and a notice that free credit expires in 30 days. Its Benefits page explicitly displays **No credits to display**. Therefore no numerical remaining promotional credit balance was established; do not treat the invoice balance or empty credit view as proof of a specific trial-credit amount. Free-service allowances above were verified independently in the subscription table.
