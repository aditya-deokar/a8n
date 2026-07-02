# MCP Threat Model

> Last updated: July 2, 2026
> Implements: Phase 0 of `docs/mcp/14-production-testing-evals-security-plan.md`
> Review cadence: before each production MCP release, after every security incident, and whenever MCP tools/resources/prompts/OAuth/webhooks/widgets change.

## System Boundary

a8n exposes workflow automation capabilities to AI clients through MCP. The primary boundary is the authenticated MCP endpoint:

```txt
MCP client / ChatGPT
  -> /api/mcp
  -> src/mcp server factory
  -> tools/resources/prompts
  -> Prisma database, Inngest execution engine, widgets, webhooks, third-party APIs
```

The MCP server is not only a read API. It can create workflow drafts, apply workflow graphs, execute workflows, inspect executions, test credentials, expose widget resources, and guide users through setup. Because workflows can call external APIs, send messages, send email, and write spreadsheets, MCP must be treated as a high-agency production interface.

## Trust Boundaries

| Boundary | Trusted side | Untrusted or lower-trust side | Main controls |
|---|---|---|---|
| User browser to a8n app | a8n app routes | Browser input, cookies, callback URLs | Better Auth, safe callback URL handling, CSRF-sensitive route design |
| MCP client to `/api/mcp` | MCP route after bearer validation | ChatGPT, MCP Inspector, Cursor, Claude, custom clients | Bearer auth, OAuth resource checks, scopes, CORS, rate limits |
| OAuth endpoints to MCP tools | Issued access token | OAuth client registration and redirect inputs | PKCE, redirect validation, token hashing, resource audience |
| MCP handlers to database | Prisma queries scoped by authenticated user | Tool arguments from model/client | `userId` ownership checks, zod schemas, transactions |
| MCP outputs to model | Sanitized `content` and `structuredContent` | Workflow names, node data, webhook payloads, execution output | Redaction, `_meta.safety`, prompt-injection detection |
| MCP widgets to browser iframe | Widget resource template and metadata | Data rendered into HTML | HTML escaping, CSP, no secrets, widget-only `_meta` |
| Workflow execution to providers | Execution engine with saved credentials | External APIs, email, Slack/Discord webhooks, Sheets | Approval gates, credential encryption, outbound egress policy |
| Webhook routes to Inngest | Verified webhook request | Google Form/Stripe/public internet payloads | Shared secret, Stripe signature, payload validation |
| CI/release to production | Release gate | Dependency updates, generated artifacts, eval results | Tests, evals, lockfile discipline, evidence retention |

## Assets

| Asset | Sensitivity | Main risks |
|---|---|---|
| Workflow graph | High | Cross-tenant read/write, malicious graph mutation, side effects |
| Workflow draft | High | Unsafe apply, prompt injection through draft fields |
| Workflow version | High | Unauthorized rollback/restore, hidden destructive diff |
| Credential secret value | Critical | Disclosure, prompt exfiltration, audit leakage |
| Credential metadata | Medium | Tenant leakage, provider enumeration |
| OAuth access token | Critical | Replay, wrong resource, broad scopes |
| OAuth refresh token | Critical | Long-lived account access |
| MCP API key | Critical | Broad tool access, leakage in logs |
| API key hash | High | Offline cracking if weak secret/hashing |
| Execution output | High | PII, prompt injection, provider errors, secrets from external systems |
| Webhook payload | High | Untrusted external content, replay, prompt injection |
| Audit log | High | Sensitive metadata, incident evidence, PII |
| Widget HTML/data | High | XSS, secret exposure, unsafe UI-triggered calls |
| Tool/resource/prompt metadata | High | Tool poisoning, risk misrepresentation, prompt steering |

## Actors

| Actor | Capability | Risk |
|---|---|---|
| Legitimate user | Connects ChatGPT, creates workflows, tests and debugs runs | Can accidentally approve harmful side effects |
| Malicious user | Has their own a8n account and MCP token | Attempts tenant escapes, SSRF, rate-limit abuse |
| Compromised MCP client | Sends crafted tool calls and malicious OAuth requests | Attempts broad access or unsafe mutations |
| Prompt-injection attacker | Controls external data consumed by workflows | Attempts to steer model into tool misuse or exfiltration |
| OAuth attacker | Crafts authorization URLs or client metadata | Attempts code theft, confused deputy, malicious redirect |
| External provider attacker | Controls HTTP/API/webhook responses | Injects malicious payloads or oversized responses |
| Insider/operator error | Misconfigures CORS, secrets, OAuth, rate limits | Broad accidental production exposure |

## STRIDE Threat Matrix

| STRIDE | Threat | Example | Required controls | Required tests/evals |
|---|---|---|---|---|
| Spoofing | Token spoofing | Fake `a8n_oauth_at_...` token | HMAC hashing, DB lookup, expiry/revocation/resource validation | OAuth invalid token tests |
| Spoofing | Client spoofing | Unknown OAuth client claims ChatGPT redirect | Exact redirect validation, DCR policy, client registry | OAuth client negative tests |
| Tampering | Workflow graph mutation | Model calls graph replace with malicious nodes | Zod input schema, graph validation, approval hash, version snapshot | Tool mutation integration tests |
| Tampering | Tool descriptor tampering | Tool description says destructive action is safe | Contract manifest, snapshot metadata review | Contract snapshot tests |
| Repudiation | Missing audit trail | Side-effect tool executes without correlation ID | Central audit wrapper, persistent audit | Audit persistence tests |
| Information Disclosure | Secret in output | Credential value appears in `structuredContent` | Central sanitization, safe selects, redaction tests | Sanitization tests, adversarial secret evals |
| Information Disclosure | Cross-tenant read | User A reads User B execution | `userId` filters everywhere | Tenant-isolation tests |
| Denial of Service | Request flood | Repeated MCP calls exhaust DB/API | Distributed rate limits, quotas, alerting | Rate-limit tests, load tests |
| Denial of Service | Unbounded output | Huge HTTP response returned to model | Response size limits, summarization | Unbounded content tests |
| Elevation of Privilege | Scope bypass | Read-only OAuth token applies draft | `requireScope` per tool | Scope guard integration tests |
| Elevation of Privilege | Excessive agency | Model executes real workflow without approval | Central approval guard, side-effect policy | Approval-gate tests and evals |

## MCP-Specific Attack Matrix

| Attack | Description | Current baseline | Required next control |
|---|---|---|---|
| Direct prompt injection | User prompt asks model to ignore instructions or call forbidden tools | Some safety patterns in `src/mcp/shared/safety.ts` | Adversarial prompt corpus and behavior evals |
| Indirect prompt injection | External data contains instructions inside workflow/output/webhook payload | `_meta.safety` warnings for matched patterns | Broader corpus, untrusted-content labeling, live evals |
| Tool poisoning | Tool description or metadata embeds malicious instructions | ChatGPT profile is curated manually | Contract manifest, descriptor snapshots, review gate |
| Tool shadowing | Tool output tells model to call another unsafe tool | Safety metadata exists for simple patterns | Cross-tool adversarial evals |
| Rug pull | Tool metadata changes after approval/review | No manifest snapshot gate yet | Tool manifest and CI diff review |
| Name collision | Lookalike tool names confuse tool selection | Curated profile helps | Contract naming rules and negative discovery evals |
| Hidden parameter misuse | Model passes unsafe hidden arguments | Zod validates known input | Parameter visibility tests and schema snapshots |
| False-error escalation | Malicious output claims user must grant more scopes | Scope guard blocks server-side | Eval that verifies no broad re-auth suggestion |
| Secret exfiltration | Output asks model to reveal credentials/tokens | Sanitization exists | Secret-leak evals and audit artifact scan |
| SSRF | HTTP/API tools target internal networks | Not centrally enforced yet | Safe outbound fetch wrapper and SSRF tests |
| Excessive agency | Model chains tools into high-risk action without consent | Some approval gates exist | Central approval guard for all side-effect/destructive tools |

## Current Controls

| Control | Status | Source |
|---|---|---|
| Bearer API key validation | Implemented | `src/mcp/auth/api-key.service.ts` |
| OAuth access token validation | Implemented | `src/mcp/auth/oauth.service.ts` |
| Scope guard | Implemented | `src/mcp/middleware/scope-guard.ts` |
| Output sanitization | Implemented | `src/mcp/shared/sanitize.ts` |
| Audit logging | Implemented | `src/mcp/middleware/audit-logger.ts` |
| Prompt-injection warning metadata | Initial implementation | `src/mcp/shared/safety.ts` |
| ChatGPT app tool profile | Implemented | `src/mcp/tools/chatgpt-profile.ts` |
| ChatGPT forbidden tool policy | Implemented | `src/mcp/safety/app-tool-policy.ts` |
| Approval hash for draft/fix apply | Implemented | Workflow draft and execution runtime tools |
| Webhook shared secret/Stripe signature | Implemented | `src/app/api/webhooks/_security.ts` |
| Offline eval scripts | Implemented | `scripts/mcp-*.ts` |

## Required Phase 1 Tests

The first test framework phase must create coverage for:

- Sanitization and redaction.
- Prompt-injection warning detection.
- API key and OAuth token validation.
- Scope checks.
- Webhook signature/shared-secret verification.
- Tenant-isolation fixtures.
- MCP offline quality checks in CI.

## Required Phase 2+ Tests

Later phases must add:

- Contract manifests and output schema validation.
- Live MCP client tests.
- Cross-tenant integration tests for every tool.
- Approval and confirmation tests for side-effect/destructive tools.
- Adversarial prompt-injection/tool-poisoning evals.
- SSRF/egress tests.
- Widget visual/security tests.

## Stop-Ship Rules

The release must stop for any issue listed in [Stop-Ship Checklist](./stop-ship-checklist.md).

## Open Risks

| Risk | Priority | Owner | Target phase |
|---|---:|---|---|
| `execute_workflow_and_wait` can run real side effects without approval | P0 | MCP backend | Phase 5 |
| Default destructive tools need confirmation hash | P0 | MCP backend | Phase 5 |
| Tool output schemas and annotations are incomplete | P0 | MCP backend | Phase 2 |
| No formal test framework currently installed | P0 | Platform | Phase 1 |
| Regex-only prompt-injection detection is incomplete | P0 | Security/evals | Phase 6 |
| In-memory rate limiting is not multi-instance safe | P1 | Platform | Phase 12 |
| OAuth production redirect policy needs exact-match hardening | P0 | Auth | Phase 7 |
| No central outbound egress policy | P1 | Execution engine | Phase 8 |

## Review Checklist for New MCP Capabilities

Every new MCP tool, resource, prompt, or widget must answer:

- What user-owned objects can it read or mutate?
- Which scope is required?
- Is it read-only, draft-write, approval-gated, side-effecting, destructive, or admin-only?
- What output schema does it guarantee?
- What data is visible to the model vs widget-only `_meta`?
- Can it expose secrets, PII, or external untrusted content?
- Can it trigger external side effects?
- Can it be abused for SSRF or unbounded consumption?
- What unit, integration, contract, and adversarial tests cover it?
- Does it belong in the ChatGPT profile?
