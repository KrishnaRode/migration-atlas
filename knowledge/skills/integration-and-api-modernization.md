---
id: integration-and-api-modernization
title: Integration and API modernization (ESB, TIBCO, MuleSoft, Boomi, IBM MQ → APIs and events)
triggers:
  technologies: [ibm-mq, rabbitmq, activemq, apigee, amazon-api-gateway, azure-api-management, kong, apache-kafka, confluent-cloud, google-pubsub, azure-event-hubs, websphere, weblogic, java, spring, dotnet, salesforce, sap-erp]
  roles: [api, streaming, application]
  keywords: [esb, integration, api, tibco, mulesoft, boomi, webmethods, soap, rest, api gateway, microservices, middleware, event-driven, ipaas, message broker, b2b, edi]
priority: 5
---

## Diagnose the ESB first
Legacy ESBs (TIBCO BusinessWorks, IBM Integration Bus/App Connect, webMethods, Oracle SOA, older MuleSoft) usually carry four kinds of work: protocol bridging, message transformation/mapping, routing/orchestration, and hidden business rules. Inventory interfaces with: source/target, protocol, volume, latency, sync vs async, error handling, and business owner. Expect undocumented interfaces; mine runtime logs and broker statistics.

## Target patterns
- **Synchronous request/response** → REST/gRPC APIs behind an API gateway/management layer (Apigee, Azure API Management, Amazon API Gateway, Kong, MuleSoft). The gateway handles authN/Z, throttling, versioning, analytics — not business logic.
- **Asynchronous integration/commands** → managed queues (SQS, Service Bus, Pub/Sub, or retain IBM MQ where transactional guarantees and mainframe connectivity matter).
- **Business events and data distribution** → event streaming (Kafka family, Pub/Sub, Event Hubs, EventBridge) with schemas and a registry.
- **SaaS-to-SaaS and simple flows** → iPaaS (MuleSoft, Boomi, Workato, Logic Apps, Application Integration) may be faster than custom code; weigh licensing.
- **B2B/EDI and managed file transfer** often stay on specialised platforms; do not force them onto APIs.

## Heuristics
- Do not rebuild a central ESB in the cloud with a new logo. Push transformation to producers/consumers or lightweight integration services owned by domains; keep a thin platform for shared capabilities.
- Prefer events for broadcasting state changes, APIs for queries and commands needing immediate answers.
- Retain IBM MQ when mainframe/CICS integration, XA transactions, or partner contracts depend on it; MQ is available as managed/container offerings (verify).
- Design idempotency, correlation ids and retries end to end; most ESB migrations break on error handling, not happy paths.

## Sequencing
1. Interface catalogue with criticality and dependency mapping.
2. Stand up the API gateway, event backbone, identity (OAuth2/OIDC, mTLS) and observability first.
3. Migrate interfaces by business domain using strangler fig: new consumers use the new API/event; legacy routes are progressively redirected.
4. Run old and new routes in parallel with message-level comparison for critical flows.
5. Decommission ESB flows as traffic reaches zero (measure, don't assume).

## Security and operations
API keys alone are not enough for sensitive APIs; use OAuth2 client credentials or mTLS, scoped tokens, WAF, and rate limiting. Distributed tracing (OpenTelemetry) across gateway, services and brokers replaces the ESB's central monitoring console.

## What to ask
Number of interfaces and protocols, peak TPS, latency SLAs, partner/B2B integrations, ESB licence end date, team skills (Java/.NET vs low-code), and security/compliance requirements.

## Red flags
- One-to-one port of every ESB flow including dead ones.
- Business rules left in gateway policies.
- No contract/schema governance for events and APIs.
- Lost transactional guarantees when replacing MQ with an event log.
