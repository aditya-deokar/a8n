# Threat Model

This is the initial production threat model for a8n. Update it when major auth, MCP, billing, webhook, credential, or deployment behavior changes.

## Assets

| Asset | Why It Matters |
|---|---|
| User accounts and sessions | Account takeover risk |
| Workflow credentials | Encrypted secrets can access third-party systems |
| OAuth tokens and authorization codes | MCP and provider access |
| MCP API keys and hashes | Programmatic access to user workflows |
| Workflow execution inputs/outputs | May contain private business data |
| Billing/customer state | Plan enforcement and revenue |
| Webhook secrets and payloads | External event integrity |
| Production database | Primary system of record |
| Production deploy credentials | Full production control |

## Trust Boundaries

| Boundary | Risk |
|---|---|
| Browser to Next.js app | Session theft, CSRF-like flows, invalid input |
| tRPC API to database | Tenant isolation and authorization bugs |
| MCP clients to MCP route | Token abuse, prompt-injection-assisted actions, scope bypass |
| External webhooks to API routes | Forged events, replay, malformed payloads |
| App to external providers | Token leaks, provider outages, unbounded retries |
| CI/CD to production | Secret exposure, unapproved deploys |

## Key Threats And Controls

| Threat | Controls |
|---|---|
| Broken tenant isolation | API contract/security tests, ownership filters, release gates |
| Credential leakage | Encryption, redaction, security scans, no raw secret responses |
| Webhook forgery | Signature/shared-secret verification, negative-path E2E tests |
| MCP scope bypass | Scope guard, auth middleware, MCP release gate |
| OAuth token abuse | Token hashing, TTLs, exact redirect URI controls |
| Database destructive migration | Migration preflight, staging rehearsal, backup requirement |
| Supply-chain compromise | Dependabot, dependency review, CodeQL, secret scan, SBOM |
| Bad production deploy | Protected environment approval, smoke, release manifest, rollback target |
| Silent production failure | Observability readiness, alert rules, dashboards, SLOs |
| Unsafe feature rollout | Feature flags, kill switches, deterministic rollout, audit notes |

## Required Review For Sensitive Changes

- Auth/session logic.
- Billing/subscription enforcement.
- Credential storage or encryption.
- MCP auth, scopes, tools, OAuth, or rate limits.
- Webhook verification.
- Prisma schema/migrations.
- CI/CD workflows and secrets.
- Feature flag or kill switch behavior.

## Open Follow-Ups

- Add provider-backed error tracking and tracing before public production traffic.
- Run a quarterly threat model refresh.
- Add formal data retention and production access policies.
- Add restore drill and incident response workflow in Phase 10.
