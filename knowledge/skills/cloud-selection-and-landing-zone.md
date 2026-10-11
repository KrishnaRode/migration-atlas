---
id: cloud-selection-and-landing-zone
title: Cloud selection and landing zone foundations (AWS, Azure, GCP)
triggers:
  technologies: [aws, azure, gcp, landing-zone, aws-vpc, azure-vnet, google-vpc, aws-direct-connect, azure-expressroute, google-cloud-interconnect, site-to-site-vpn, private-connectivity, vpc-service-controls, aws-iam, google-iam, microsoft-entra-id, terraform]
  roles: [cloud-platform, network, security, devops]
  keywords: [landing zone, which cloud, aws vs azure, gcp, multi-cloud, networking, hub and spoke, organization policy, account structure, subscriptions, projects, interconnect, private endpoint, foundation]
priority: 5
---

## Choosing a cloud
Choose on enterprise factors, not data-platform features alone:
- Existing enterprise agreements, committed spend and Microsoft/Oracle/SAP licensing.
- Identity estate (Microsoft Entra ID is near-universal; all clouds federate with it).
- Where key applications and SaaS already run; data gravity and egress.
- Regional presence for residency (verify region and service availability per country).
- Skills of the platform/operations team and partner ecosystem.
- Regulatory attestations needed (verify current compliance programs).
Multi-cloud for data is common through Databricks/Snowflake, but running full foundations on several clouds multiplies security and network effort. Pick a primary cloud unless there is a hard reason not to.

## Landing zone essentials (before any data lands)
- **Resource hierarchy**: AWS Organizations + OUs + accounts (Control Tower), Azure management groups + subscriptions (Azure Landing Zones), GCP organization + folders + projects. Separate prod/non-prod and by sensitivity; one workload per account/subscription/project is a good default.
- **Identity**: federate from the corporate IdP, enforce MFA, use groups not users, no long-lived keys; workload identity for services. Break-glass accounts documented and monitored.
- **Guardrails**: SCPs (AWS), Azure Policy, GCP Organization Policies — restrict regions, block public buckets/IPs, require encryption, enforce tagging.
- **Networking**: hub-and-spoke or transit (Transit Gateway, Azure Virtual WAN/hub VNet, GCP Shared VPC/NCC). Plan non-overlapping CIDRs with the on-prem network team early. Private endpoints/PrivateLink/Private Service Connect for PaaS data services; data exfiltration controls (VPC Service Controls on GCP, endpoint policies elsewhere).
- **Hybrid connectivity**: Direct Connect / ExpressRoute / Cloud Interconnect for bulk and steady data transfer, VPN as backup or for small volumes. Provisioning takes weeks; order early. Size for migration peak, not steady state.
- **DNS**: hybrid resolution for private endpoints is a classic blocker; design it explicitly.
- **Logging and security**: central log archive account/project, cloud audit logs on, security posture tooling, SIEM integration.
- **Keys and secrets**: KMS/Key Vault/Cloud KMS, customer-managed keys where policy requires, central secrets manager.
- **Cost controls**: budgets, alerts, mandatory tags (cost centre, owner, environment).
- **Everything as code**: Terraform or native IaC, pipelines with approvals; no click-ops in production.

## Sequencing
Week 0–6 typically: hierarchy, identity, network, logging, guardrails, CI/CD for infra. Data platform workspaces come after. Migrations that start before the landing zone usually rebuild later.

## What to ask
Primary cloud and agreements, IdP, regions and residency, on-prem network team contacts and IP plan, connectivity bandwidth, security team requirements (CMK, private-only), and existing cloud footprint to integrate with.

## Red flags
- Public endpoints for data services "temporarily."
- Overlapping IP ranges discovered during interconnect setup.
- Single account/subscription for all environments.
- No owner for the landing zone after the migration partner leaves.
