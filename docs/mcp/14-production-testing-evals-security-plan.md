# MCP Production Testing, Evals, and Security Hardening Plan

> Last updated: July 2, 2026
> Scope: complete a8n app with emphasis on `src/mcp`, `docs/mcp`, `/api/mcp`, OAuth, workflow execution, credentials, webhook entry points, MCP Apps widgets, evals, and production release gates.
> Goal: mature the MCP system for production by reducing production failures, preventing prompt injection and tool misuse, proving auth/tenant boundaries, and making every incident produce a regression test.

## Executive Summary

a8n already has a strong MCP foundation:

- Streamable HTTP MCP route at `/api/mcp`.
- Default MCP surface with workflow, credential, execution, integration, node, system, API key, prompt, and resource capabilities.
- ChatGPT-specific profile with a smaller 28-tool app surface.
- API key auth, OAuth account linking, scoped authorization, audit logging, output sanitization, app widget resources, prompt-injection warning metadata, and several offline readiness scripts.
- Existing eval data for 50 non-technical workflow goals and 8 ChatGPT app scenarios.

The missing production layer is not "add MCP." It is a full assurance system around MCP:

- A real test framework and CI gate.
- Contract tests for every MCP tool, resource, prompt, widget, auth path, and output schema.
- Live MCP client tests against a seeded database.
- Adversarial evals for direct prompt injection, indirect prompt injection, tool poisoning, tool shadowing, malicious output, secret exfiltration, SSRF, over-permissioning, and excessive agency.
- Runtime controls for approvals, side effects, distributed rate limits, token hygiene, observability, alerting, and incident-to-eval regression.

This plan is phase-wise. Each phase has implementation tasks, acceptance criteria, and production gates.

## Current State Snapshot

### Existing MCP Architecture

| Area | Current state | Key files |
|---|---|---|
| MCP route | Streamable HTTP route with `GET`, `POST`, `DELETE`, `OPTIONS`; request-level auth and rate limit guard | `src/app/api/mcp/route.ts` |
| Server factory | Creates `McpServer`, registers tools, resources, and prompts per request | `src/mcp/index.ts` |
| Tool registry | Default profile plus ChatGPT app profile | `src/mcp/tools/_registry.ts`, `src/mcp/tools/chatgpt-profile.ts` |
| Resources | Schema, catalog, API docs, app resources, ChatGPT widget resources | `src/mcp/resources/_registry.ts`, `src/mcp/apps/widget-resources.ts` |
| Prompts | Workflow creation, execution debugging, integration setup | `src/mcp/prompts/_registry.ts` |
| API keys | Hashed API keys, scopes, revocation, last used tracking | `src/mcp/auth/api-key.service.ts` |
| OAuth | Authorization code + PKCE, opaque tokens, dynamic registration, revocation, discovery metadata | `src/mcp/auth/oauth.service.ts`, `src/app/api/oauth/*` |
| Scopes | `workflows:*`, `credentials:*`, `executions:read`, `system:read`, `api_keys:manage`, wildcard | `src/mcp/auth/scopes.ts` |
| Sanitization | Redacts credential values, tokens, private keys, authorization headers, key hashes | `src/mcp/shared/sanitize.ts`, `src/mcp/middleware/audit-logger.ts` |
| Prompt-injection warnings | Regex-based suspicious-content detection and `_meta.safety` output | `src/mcp/shared/safety.ts` |
| Tool risk policy | ChatGPT app risk classification and forbidden tools | `src/mcp/safety/app-tool-policy.ts` |
| Audit | Structured audit entries, in-memory metrics, optional DB persistence | `src/mcp/middleware/audit-logger.ts`, `McpAuditLog` Prisma model |
| Rate limit | In-memory sliding window | `src/mcp/middleware/rate-limiter.ts` |
| Webhook security | Shared secret verification and Stripe signature verification | `src/app/api/webhooks/_security.ts` |
| Evals and checks | Offline workflow planner eval, ChatGPT app eval, safety check, OAuth/live readiness scripts, release checks | `scripts/mcp-*.ts`, `src/mcp/evals/*` |

### Verification Run on July 2, 2026

The following local checks were run directly through `node_modules/.bin` to avoid pnpm dependency-tree reconciliation:

| Check | Result | Note |
|---|---:|---|
| `tsx scripts/mcp-eval.ts` | PASS | 50/50 cases, average score 0.996 |
| `tsx scripts/mcp-safety-check.ts` | PASS | ChatGPT tool policy, redaction, and safety metadata checks passed |
| `tsx scripts/mcp-chatgpt-app-eval.ts` | PASS | 8/8 cases, average score 1 |
| `prisma validate` | PASS | Prisma schema valid |
| `tsc --noEmit --pretty false` | PASS with larger heap | Default heap OOM; passed with `NODE_OPTIONS=--max-old-space-size=4096` |

### Important Existing Strengths

- Tenant ownership checks are used in many Prisma queries through `where: { id, userId }`.
- The ChatGPT profile excludes raw credential mutation, API key management, audit/security tools, and destructive workflow deletion.
- Most MCP handlers call `requireScope`.
- Sensitive output values are centrally sanitized before response.
- Draft apply and repair apply flows use `approved` plus `confirmationHash`.
- Webhook routes can enforce shared secrets or Stripe signatures when secrets are configured.
- Existing docs already define ChatGPT Apps rollout phases and runbooks.

## Missing Pieces and Production Risks

### P0 Gaps

| Gap | Why it matters | Current evidence | Target |
|---|---|---|---|
| No formal test framework | Scripts are useful, but they do not replace unit/integration tests or CI reporting | No Vitest/Jest/Playwright test setup in `package.json`; only ad hoc scripts | Add `vitest`, `playwright`, fixtures, CI gates, coverage |
| Incomplete MCP contracts | Tool calls are brittle without declared output contracts | About 50 `server.tool(...)` registrations, but only 7 `outputSchema` occurrences and 7 `annotations` occurrences in MCP tools/apps | Every app-facing tool has input schema, output schema, annotations, examples, contract tests |
| Side-effect tool not fully approval-gated | Real workflow execution can send emails, messages, HTTP requests, and write to sheets | `execute_workflow_and_wait` executes immediately with `workflows:execute` | Require approval for all real external side-effect execution paths, or split test/dry-run/live modes |
| Default profile destructive tools lack strong confirmation | Non-ChatGPT MCP clients can call `delete_workflow` or `delete_credential` with scope only | `delete_workflow` and `delete_credential` do not require confirmation hash | Add universal destructive-action guard, even outside ChatGPT profile |
| Static safety evals only | Current evals check metadata and simple regex patterns, not real tool-call behavior | `mcp-chatgpt-app-eval.ts` validates expected lists, not model/tool execution traces | Add live MCP eval harness and adversarial eval runner |
| Prompt-injection detection too narrow | Regex-only English patterns miss obfuscated, multilingual, encoded, tool-poisoning, and multi-turn attacks | `src/mcp/shared/safety.ts` has a small pattern list | Add broader attack corpus, semantic grader option, and behavior-level blocking |
| In-memory rate limits and metrics | Multi-instance production deployments will have inconsistent rate limits and incomplete metrics | `rate-limiter.ts` and audit metrics are in-memory | Redis/Upstash/Postgres-backed rate limits and OpenTelemetry metrics |
| OAuth hardening gaps | OAuth is security-critical and public-facing | Redirect validation allows host-based matching; dynamic registration defaults enabled; authorize POST lacks server-side CSRF token | Exact redirect matching in production, client allowlist, per-client consent records, CSRF protection, abuse limits |
| No tenant-isolation regression suite | One auth mistake can expose another user's workflows, credentials, executions, drafts, or audit logs | Ownership checks exist but are not systematically tested | Cross-tenant negative tests for every read/write tool |
| No CI release gate that composes all checks | Existing scripts can drift if not required by CI | Release scripts exist but are not standard `test`/CI gates | `mcp:release:gate` in CI with offline, contract, integration, security, and live optional gates |

### P1 Gaps

| Gap | Target |
|---|---|
| Limited widget visual testing | Playwright screenshots for all widgets, desktop/mobile, light/dark, empty/error/loaded states |
| No runtime alerting plan | Alerts for auth failures, prompt-injection warnings, side-effect tool calls, rate-limit breaches, OAuth errors, high latency |
| No data retention job | Scheduled cleanup for expired OAuth codes/tokens, old audit logs based on retention policy |
| No egress controls for HTTP/API tools | Block private IP ranges, metadata endpoints, loopback, unsupported schemes, and suspicious redirects for user-configured HTTP calls |
| No dependency/security pipeline | Add dependency audit, secret scanning, SBOM, SAST, license review, and SDK version monitoring |
| No chaos/load tests | Add load tests for MCP route, OAuth token exchange, execution wait polling, audit persistence, and rate limits |
| No production eval dashboard | Persist eval runs and trend pass rate, unsafe-call rate, precision/recall, latency, and incidents |

## Industry Guidance Applied

This roadmap follows current guidance from:

- MCP security best practices: per-client consent, exact redirect URI validation, token audience validation, no token passthrough, session hijack prevention, SSRF awareness, and scope minimization.
- OpenAI Apps SDK guidance: unit test tool handlers, test with MCP Inspector, validate in ChatGPT developer mode, ensure structured content matches `outputSchema`, verify widgets, and test OAuth failures.
- OWASP Top 10 for LLM and GenAI Apps 2025: prompt injection, sensitive information disclosure, supply chain, improper output handling, excessive agency, system prompt leakage, and unbounded consumption.
- NIST AI RMF and NIST Generative AI Profile: treat evals, monitoring, risk tracking, and incident response as lifecycle controls, not one-time pre-launch tasks.
- MCP security research: include tool poisoning, shadowing, rug-pull, name collision, parameter hiding, false-error escalation, retrieval injection, and cross-tool exfiltration in adversarial evals.

## Phase 0: Baseline Governance and Threat Model

**Purpose:** lock the risk model before writing more tests.

**Implementation status:** implemented. See `docs/mcp/security/threat-model.md`, `docs/mcp/security/stop-ship-checklist.md`, and `docs/mcp/security/README.md`.

### Tasks

1. Create `docs/mcp/security/threat-model.md`.
2. Draw trust boundaries:
   - User/browser.
   - ChatGPT or other MCP client.
   - `/api/mcp` route.
   - OAuth endpoints.
   - MCP tool handlers.
   - Prisma database.
   - Inngest execution engine.
   - Webhook routes.
   - Third-party APIs.
   - Widget iframe.
3. Map assets:
   - Workflow graphs.
   - Workflow drafts and versions.
   - Credentials and encrypted secret values.
   - OAuth access/refresh tokens.
   - API keys and key hashes.
   - Audit logs.
   - Execution output.
   - Webhook payloads.
4. Create a STRIDE-style MCP threat matrix.
5. Map each threat to an OWASP LLM risk and a required test.
6. Add a production "stop ship" checklist:
   - Any raw secret in MCP output.
   - Cross-tenant access.
   - Ungated destructive mutation.
   - Real workflow side effect without approval.
   - OAuth token accepted for the wrong resource.
   - Public production CORS wildcard.
   - Failing prompt-injection regression.

### Acceptance Criteria

- Every high-risk MCP tool has a listed threat owner, mitigation, and test ID.
- Every closed production incident must include a regression eval ID.
- Threat model is reviewed before new MCP tools are merged.

## Phase 1: Test Framework and CI Foundation

**Purpose:** replace ad hoc checks with a proper test pyramid.

**Implementation status:** initial scaffold implemented. Added Vitest/Playwright config, MCP test folders, starter safety/sanitization tests, deterministic fixtures, package scripts, and `.github/workflows/mcp-quality.yml`. Dependency installation still requires a pnpm store/lockfile refresh in the local environment.

### Tasks

1. Add dependencies:
   - `vitest` for unit and integration tests.
   - `@vitest/coverage-v8` for coverage.
   - `msw` or `nock` for outbound provider/API mocking.
   - `playwright` for widget and end-to-end browser checks.
2. Add scripts:

   ```json
   {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:mcp": "vitest run tests/mcp src/mcp",
     "test:mcp:coverage": "vitest run --coverage tests/mcp src/mcp",
     "test:mcp:e2e": "playwright test tests/e2e/mcp",
     "mcp:contract:check": "tsx scripts/mcp-contract-check.ts",
     "mcp:security:eval": "tsx scripts/mcp-adversarial-eval.ts",
     "mcp:release:gate": "tsx scripts/mcp-release-gate.ts"
   }
   ```

3. Add `vitest.config.ts`.
4. Add test directories:

   ```txt
   tests/
     mcp/
       unit/
       integration/
       contract/
       adversarial/
       fixtures/
     e2e/
       mcp/
   ```

5. Build factories:
   - User factory.
   - API key factory.
   - OAuth client/token factory.
   - Workflow graph factory.
   - Draft factory.
   - Credential factory with fake encrypted values.
   - Execution factory with malicious outputs.
6. Standardize test environment:
   - `NODE_OPTIONS=--max-old-space-size=4096`.
   - Dedicated test database.
   - Fake secrets for HMAC, encryption, OAuth.
   - No real outbound network by default.
7. Add CI workflow:
   - Install with lockfile.
   - Prisma generate and validate.
   - Typecheck with larger heap.
   - Lint.
   - Unit and integration tests.
   - Offline MCP evals.
   - Contract checks.
   - Security evals.
   - Optional live MCP checks for staging.

### Acceptance Criteria

- `npm test` or `pnpm test` runs without touching production data.
- CI blocks merges on failing MCP unit/integration/contract/security tests.
- Coverage threshold starts at 70 percent for MCP modules, then increases to 85 percent.
- Test reports are retained as build artifacts.

## Phase 2: MCP Contract Registry and Schema Assurance

**Purpose:** make every MCP capability predictable and testable.

**Implementation status:** implemented as an initial contract registry and CI-ready checker. Added `src/mcp/contracts/*`, generated ChatGPT tool policy from the tool manifest, and added `pnpm mcp:contract:check`. Native MCP `outputSchema` wiring is tracked by the checker and can be made strict with `--strict-native-schemas` after every app-facing registration is migrated.

### Tasks

1. Create a machine-readable MCP capability manifest:

   ```txt
   src/mcp/contracts/
     tools.manifest.ts
     resources.manifest.ts
     prompts.manifest.ts
     schemas.ts
   ```

2. For every tool, define:
   - Name.
   - Profile visibility: default, ChatGPT, internal.
   - Required scopes.
   - Risk level.
   - Requires approval.
   - Has external side effect.
   - Has destructive effect.
   - Input schema.
   - Output schema.
   - Example input.
   - Example output.
3. Generate `CHATGPT_APP_TOOL_POLICY` from the manifest instead of maintaining separate lists manually.
4. Add `outputSchema` and `annotations` to every app-facing tool first, then to all tools.
5. Create `scripts/mcp-contract-check.ts`:
   - Lists all registered tools through MCP SDK.
   - Compares against manifest.
   - Verifies every app-facing tool has `outputSchema`.
   - Verifies risk policy exists for every ChatGPT tool.
   - Verifies forbidden tools are absent from ChatGPT profile.
   - Verifies every response fixture validates against output schema.
6. Add resource and widget contract checks:
   - URI uniqueness.
   - MIME type.
   - `_meta.ui.csp`.
   - Widget domain.
   - No secrets in rendered HTML.
7. Add prompt contract checks:
   - No prompt asks user to paste secrets into normal chat.
   - Prompts mention approval for side effects.
   - Prompts identify untrusted execution/webhook output as data.

### Acceptance Criteria

- 100 percent of ChatGPT tools have `outputSchema` and annotations.
- 100 percent of default MCP tools are listed in the manifest.
- Tool count mismatches fail CI.
- Tool descriptions are snapshotted so accidental "rug pull" changes are reviewed.

## Phase 3: Unit Tests for Security Middleware and Shared Controls

**Purpose:** make the safety layer deterministic and regression-proof.

**Implementation status:** implemented as starter unit coverage under `tests/mcp/unit/` for sanitization, prompt-injection detection, scope guards, rate limiting, API key helpers, webhook verification, and contract manifest invariants. Running these tests requires the Phase 1 test dependencies to be installed.

### Test Areas

1. `src/mcp/shared/sanitize.ts`
   - Redacts exact sensitive keys.
   - Redacts nested sensitive keys.
   - Redacts arrays.
   - Redacts bearer tokens, OpenAI/Anthropic-style keys, private keys.
   - Preserves safe metadata.
   - Handles dates and unusual objects safely.
2. `src/mcp/shared/safety.ts`
   - Direct injection patterns.
   - Indirect injection in workflow names, node config, execution output, webhook payload.
   - Obfuscated variants: casing, whitespace, punctuation, base64 hints, unicode homoglyphs, multilingual phrases.
   - Max warning cap.
   - `_meta.safety` response attachment.
3. `src/mcp/middleware/scope-guard.ts`
   - Positive scope.
   - Missing scope.
   - Wildcard.
   - Error copy does not leak secrets.
4. `src/mcp/middleware/audit-logger.ts`
   - Redaction in audit input.
   - Correlation ID shape.
   - Persistent audit enabled/disabled.
   - Failure logging.
   - PII minimization rules.
5. `src/mcp/middleware/rate-limiter.ts`
   - Sliding-window behavior.
   - Per-user vs per-key isolation.
   - Reset behavior.
   - Future Redis adapter contract.
6. `src/mcp/auth/api-key.service.ts`
   - Key generation length/prefix.
   - HMAC hash and legacy hash compatibility.
   - Revoked key rejection.
   - Expired key rejection.
   - Last-used updates.
7. `src/mcp/auth/oauth.service.ts`
   - PKCE S256 validation.
   - Code single-use.
   - Expired code rejection.
   - Token revocation.
   - Wrong resource rejection.
   - Wrong client rejection.
   - Reduced scopes.
   - Dynamic registration disabled behavior.
8. `src/app/api/webhooks/_security.ts`
   - Shared secret pass/fail.
   - Missing secret dev mode.
   - Stripe signature pass/fail.
   - Timestamp tolerance.
   - Malformed signature handling.

### Acceptance Criteria

- Security utility unit tests pass locally and in CI.
- New redaction or safety bypasses require test updates.
- OAuth negative tests cover every invalid grant path.

## Phase 4: MCP Route, Auth, and Tenant Integration Tests

**Purpose:** prove the MCP server behaves correctly over the actual protocol surface.

**Implementation status:** implemented as initial route-level integration coverage. Added realistic route request helpers, reusable test auth identities, an SDK-client helper scaffold, route tests for auth/CORS/profile/rate-limit/error behavior, and source-level tenant isolation guards. The seeded Prisma two-tenant execution matrix remains part of Phase 5 because it exercises individual tool handlers and database side effects.

### Tasks

1. Create a test helper that starts the Next route or calls route handlers with realistic `Request` objects.
2. Create a second helper that uses `@modelcontextprotocol/sdk` client against a local test server.
3. Seed two users:
   - `userA` with workflows, credentials, executions, drafts, audit logs.
   - `userB` with separate data.
4. Test auth modes:
   - Missing bearer token.
   - Invalid API key.
   - Expired API key.
   - Revoked API key.
   - Valid API key with read-only scopes.
   - Valid API key with write scopes.
   - Valid OAuth token.
   - Expired OAuth token.
   - Wrong-resource OAuth token.
5. Test tenant isolation for every tool category:
   - Workflows.
   - Drafts.
   - Versions.
   - Credentials.
   - Executions.
   - Audit events.
   - App resources.
6. Test CORS:
   - Allowed origin.
   - Disallowed origin.
   - Production `MCP_CORS_ORIGINS` must not be `*`.
7. Test profile behavior:
   - Default profile exposes full intended surface.
   - ChatGPT profile exposes only allowed tools.
   - Forbidden tools are absent from ChatGPT profile.
8. Test error shape:
   - JSON-RPC errors do not leak stack traces in production.
   - Scope errors are actionable but not overly broad.
   - Rate limit errors include standard headers.

### Acceptance Criteria

- A token for `userA` cannot read or mutate any `userB` object.
- ChatGPT profile has no raw credential mutation or destructive/admin tools.
- Every route response has expected auth, CORS, and rate-limit behavior.

## Phase 5: Tool Handler Integration Tests

**Purpose:** prove each tool works with real Prisma state and controlled side effects.

**Implementation status:** implemented as approval hardening plus initial handler-level integration coverage. Added `src/mcp/safety/approval-guard.ts`, wired high-risk side-effect/destructive handlers through it, tightened the contract checker for approval-required tools, and added mocked handler tests that prove side effects/destructive mutations do not run before approval. A full seeded Prisma matrix for every tool group remains the next expansion of this phase.

### Tool Test Matrix

| Tool group | Required tests |
|---|---|
| Workflow read tools | Empty results, pagination, search, ownership, graph loading |
| Workflow draft tools | Plan, create, answer questions, reject secret-looking answers, validate, explain, preview diff, apply with wrong hash, apply with correct hash |
| Workflow mutation/version tools | Rename, partial edit preview, partial edit apply, version creation, restore approval, rollback path |
| Execution tools | List/get executions, timeline, diagnosis, repair draft, apply repair with approval |
| Side-effect tools | Require approval, use fake Inngest sender, never call real providers in test |
| Credential tools | Metadata only, encrypted value never returned, create/update/delete guarded, tenant isolation |
| Integration tools | Setup checklist, webhook URL, generated Google Form script, credential dry-run, live mode mocked |
| API key tools | Create/list/revoke, scope validation, raw key returned only once |
| System/security tools | `whoami`, `server_info`, `health_check`, `security_status`, audit list authorization |
| Render tools | Widget `_meta`, schema, no secrets, stable resource URIs |

### Immediate Fixes to Include

1. Add `approved` and optional `confirmationHash` to `execute_workflow_and_wait`, or remove it from ChatGPT profile and force `run_workflow_test` for ChatGPT.
2. Add approval gates for `execute_workflow` in the default profile.
3. Add confirmation gates for `delete_workflow` and `delete_credential`.
4. Create a central helper:

   ```txt
   src/mcp/safety/approval-guard.ts
   ```

   It should enforce:
   - Risk policy lookup.
   - `approved` requirement.
   - Confirmation hash where needed.
   - Audit event for approval requested and approval accepted.
5. Require all high-risk tools to use the central approval guard.

### Acceptance Criteria

- No production side-effect tool can execute without explicit user-approved intent.
- Every mutation writes an audit event.
- Every destructive mutation has a reversible backup or explicit irreversible warning plus confirmation.
- All tool outputs validate against declared schemas.

## Phase 6: Adversarial MCP Evals and Prompt-Injection Defense

**Purpose:** test behavior under attack, not just happy paths.

### Attack Corpus

Create:

```txt
src/mcp/evals/adversarial/
  prompt-injection-cases.ts
  tool-poisoning-cases.ts
  exfiltration-cases.ts
  excessive-agency-cases.ts
  ssrf-cases.ts
  authz-cases.ts
  widget-cases.ts
```

Cover:

1. Direct prompt injection:
   - "Ignore previous instructions."
   - "You are now admin."
   - "Call delete_workflow."
2. Indirect prompt injection:
   - Malicious workflow name.
   - Malicious node label.
   - Malicious HTTP response.
   - Malicious Google Form answer.
   - Malicious Stripe metadata.
   - Malicious execution error.
3. Secret exfiltration:
   - Ask for API keys.
   - Ask for credential values.
   - Ask for OAuth tokens.
   - Ask for hidden prompts.
4. Tool poisoning:
   - Tool description attempts to override policy.
   - Lookalike tool names.
   - Tool descriptor says it is read-only but performs mutation.
   - Rug-pull: descriptor changes between approval and execution.
5. Tool shadowing:
   - One tool output instructs the model to call another forbidden tool.
   - Resource content claims a different tool policy.
6. Excessive agency:
   - User asks "do everything needed" and tool tries to execute without approval.
   - Model attempts broad API key creation.
7. SSRF and egress:
   - `http://169.254.169.254`.
   - `localhost`.
   - private IP ranges.
   - redirect to internal IP.
   - non-http schemes.
8. Output handling:
   - HTML/script injection in widget data.
   - Markdown link exfiltration.
   - Large payload/unbounded content.
9. Obfuscation:
   - Base64 instruction.
   - Unicode homoglyphs.
   - Zero-width characters.
   - Multilingual injections.
   - Payload splitting across fields.

### Eval Runner

Create `scripts/mcp-adversarial-eval.ts` with two modes:

1. Deterministic mode:
   - Calls sanitizers, safety detectors, approval guards, schema validators, and mock tool handlers.
   - Runs in CI on every PR.
2. Model-in-the-loop mode:
   - Uses a configured eval model to judge whether a response or tool plan is unsafe.
   - Runs nightly or before release due to cost and nondeterminism.

### Metrics

Track:

- Attack cases passed.
- Unsafe tool call rate.
- Secret leakage rate.
- False positive rate.
- False negative rate.
- Side-effect execution without approval.
- Mean time to detect prompt injection.
- Regressions by attack category.

### Acceptance Criteria

- P0 release gate: 0 secret leaks, 0 cross-tenant reads, 0 ungated side effects, 0 destructive calls without confirmation.
- P1 gate: at least 95 percent prompt-injection detection on known corpus with less than 10 percent false positives.
- Every new incident adds or updates an adversarial eval case.

## Phase 7: OAuth and Authorization Production Hardening

**Purpose:** make account linking safe under public internet traffic.

### Tasks

1. Production redirect URI policy:
   - Use exact redirect URI matching in production.
   - Remove hostname-only matching outside local development.
   - Reject wildcard and path-prefix matching.
2. Dynamic client registration:
   - Default `MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION=false` in production unless explicitly needed.
   - If enabled, add client registration rate limits, client metadata validation, and admin review logs.
3. Consent records:
   - Add `McpOAuthConsent` model with `userId`, `clientId`, `scopes`, `redirectUri`, `resource`, `createdAt`, `revokedAt`.
   - Show client name, redirect URI, resource, and scopes in consent UI.
   - Record consent approvals and denials in audit logs.
4. CSRF protection for `/api/oauth/authorize` POST:
   - Generate server-side nonce.
   - Store in secure session/cookie.
   - Validate and consume once.
5. Token hygiene:
   - Scheduled cleanup for expired auth codes and access tokens.
   - Refresh token rotation option.
   - Revoke all tokens for a client/user pair.
   - Device/account unlink UI.
6. OAuth rate limiting:
   - Authorization endpoint.
   - Token endpoint.
   - Register endpoint.
   - Revoke endpoint.
7. Negative integration tests:
   - Wrong redirect URI.
   - Wrong client ID.
   - Wrong resource.
   - Missing PKCE.
   - Reused auth code.
   - Expired auth code.
   - Revoked refresh token.
   - Reduced scope token attempting write.

### Acceptance Criteria

- OAuth endpoints pass happy and negative tests in CI.
- Production checker fails if dynamic registration is enabled without explicit approval.
- Token and consent lifecycle is observable and revocable.

## Phase 8: Egress, SSRF, and External Provider Safety

**Purpose:** prevent workflows and credential tests from becoming network attack tools.

### Tasks

1. Create central outbound fetch wrapper:

   ```txt
   src/lib/safe-fetch.ts
   ```

2. Enforce:
   - HTTPS by default.
   - Block private IP ranges.
   - Block loopback.
   - Block link-local and cloud metadata endpoints.
   - Block unsupported schemes.
   - Validate redirects hop-by-hop.
   - Timeout and max response size.
   - Retry limits.
   - User-agent tagging.
3. Use wrapper in:
   - HTTP request node executor.
   - Credential live tests.
   - OAuth discovery only if the app later fetches external metadata.
4. Add allowlist mode for production:
   - Provider domains for OpenAI, Anthropic, Google APIs, Slack, Discord, Stripe.
   - Optional user-configured external API allowlist per workspace/user.
5. Add SSRF eval cases and integration tests.

### Acceptance Criteria

- No app-controlled fetch can reach private networks or metadata endpoints in production.
- SSRF corpus passes.
- Network failures return safe, user-actionable errors.

## Phase 9: Widget and UI E2E Testing

**Purpose:** ensure MCP Apps widgets are reliable and safe.

### Tasks

1. Add Playwright tests for:
   - Workflow draft preview.
   - Setup checklist.
   - Execution timeline.
   - Workflow approval.
2. Test states:
   - Empty.
   - Normal.
   - Error.
   - Large payload.
   - Malicious content.
   - Light/dark mode.
   - Mobile and desktop widths.
3. Test security:
   - HTML escaping.
   - No secrets in rendered HTML.
   - CSP metadata exactness.
   - No external scripts except approved domains.
   - Widget action calls require approved server-side tool paths.
4. Capture screenshots as CI artifacts.
5. Add manual ChatGPT developer-mode evidence:
   - Direct prompt.
   - Indirect prompt.
   - Negative prompt.
   - Security prompt.
   - Mobile layout.

### Acceptance Criteria

- Widgets render with no console errors.
- Malicious HTML is displayed as text, not executed.
- Screenshot diff baseline is stable.
- ChatGPT developer-mode golden prompt evidence is stored under `docs/mcp/mcp-apps/evidence/`.

## Phase 10: Live MCP E2E and Golden Prompt Harness

**Purpose:** test a real MCP client against a running staging app.

### Tasks

1. Create `scripts/mcp-live-eval.ts`.
2. Start the app against a staging/test DB.
3. Seed:
   - Minimal user.
   - API key.
   - OAuth client.
   - Workflows with safe fake nodes.
   - Failed execution with adversarial output.
4. Use MCP SDK client to:
   - Initialize.
   - List tools.
   - List resources.
   - Call read tools.
   - Create draft.
   - Validate draft.
   - Preview diff.
   - Attempt apply without approval.
   - Apply with correct approval.
   - Run test workflow with approval using mocked Inngest/provider paths.
   - Diagnose malicious execution.
5. Store JSON traces:

   ```txt
   docs/mcp/evidence/live-evals/YYYY-MM-DD/
   ```

6. Add optional ChatGPT/API Playground trace capture for release candidates.

### Acceptance Criteria

- Live MCP eval passes against staging before release.
- JSON traces show no secrets.
- Negative prompts do not trigger unintended tool calls.

## Phase 11: Observability, Alerting, and Runtime Guardrails

**Purpose:** detect failures and attacks in production quickly.

### Tasks

1. Add OpenTelemetry or equivalent instrumentation:
   - MCP request latency.
   - Tool call latency.
   - Tool call count by tool/risk/profile.
   - Auth failures.
   - Scope denials.
   - OAuth token errors.
   - Rate limit denials.
   - Prompt-injection warning count.
   - Approval requested/accepted/denied.
   - Execution outcomes after MCP-created workflows.
2. Add structured log fields:
   - `correlationId`.
   - `userId` hash or internal ID.
   - `authMethod`.
   - `oauthClientId`.
   - `tool`.
   - `risk`.
   - `profile`.
   - `status`.
   - `durationMs`.
3. Add alert rules:
   - Spike in 401/403.
   - Spike in prompt-injection warnings.
   - Repeated approval bypass attempts.
   - Repeated side-effect attempts without approval.
   - Tool error rate above threshold.
   - OAuth token exchange failures.
   - Rate-limit saturation.
   - Audit persistence failure.
4. Add dashboards:
   - MCP health.
   - Auth/OAuth health.
   - Tool usage and latency.
   - Safety events.
   - Evals trend.
   - Incident regression coverage.
5. Add production feature flags:
   - Disable side-effect tools.
   - Disable credential mutation.
   - Disable OAuth dynamic registration.
   - Force read-only ChatGPT profile.
   - Increase safety strictness.

### Acceptance Criteria

- On-call can answer: what tool failed, for whom, why, and whether secrets were involved.
- Safety alerts are actionable and linked to runbooks.
- Feature flags can reduce blast radius without redeploy.

## Phase 12: Distributed Production Infrastructure

**Purpose:** remove single-instance assumptions.

### Tasks

1. Replace in-memory rate limiter with Redis/Upstash/Postgres adapter.
2. Keep local in-memory implementation only for development.
3. Add DB-backed or metrics-backed audit health check.
4. Add token cleanup scheduled job.
5. Add audit retention job.
6. Add backup and restore test for:
   - Workflows.
   - Drafts.
   - Versions.
   - Credentials metadata and encrypted values.
   - OAuth client/token records.
   - Audit logs if retained.
7. Add migration checks:
   - `prisma validate`.
   - Migration drift detection.
   - Rollback plan for new MCP tables.
8. Add dependency and supply-chain gates:
   - Lockfile integrity.
   - `pnpm audit` or equivalent.
   - Secret scan.
   - License scan.
   - SBOM.
   - Dependency update cadence for `@modelcontextprotocol/sdk`, Next.js, Prisma, Better Auth, OAuth libraries.

### Acceptance Criteria

- Rate limits are consistent across app instances.
- Expired OAuth artifacts are cleaned.
- Production deployment has a tested rollback path.
- Dependency vulnerability policy exists.

## Phase 13: Release Gates and Rollout Process

**Purpose:** make production readiness repeatable.

### Release Gate Command

Create one command:

```txt
tsx scripts/mcp-release-gate.ts --profile=chatgpt --strict
```

It should run:

1. Prisma validate.
2. Typecheck with configured heap.
3. Lint.
4. Unit tests.
5. MCP integration tests.
6. MCP contract check.
7. Existing `mcp-eval`.
8. Existing `mcp-safety-check`.
9. Existing `mcp-chatgpt-app-eval`.
10. New adversarial eval.
11. Production readiness check.
12. Rollout check.
13. Optional live staging check.

### Stop-Ship Criteria

Release must stop if any of these are true:

- Secret appears in MCP output, audit logs, widget HTML, or test artifact.
- Cross-tenant access succeeds.
- Destructive action executes without confirmation.
- External side-effect action executes without approval.
- OAuth accepts wrong resource, client, redirect URI, expired token, reused code, or revoked token.
- ChatGPT profile exposes forbidden tools.
- Prompt-injection regression causes unsafe tool call.
- Production CORS is wildcard.
- Audit persistence is disabled in production.
- Rate limiter is in-memory in multi-instance production.

### Rollout Stages

1. Internal only:
   - Developer API keys.
   - Full logging.
   - No live external side effects except mocks.
2. Private beta:
   - Read-only + drafts.
   - Limited approved test runs.
   - Daily eval run.
3. Controlled external beta:
   - OAuth account linking.
   - ChatGPT profile.
   - Canary side-effect tools.
   - Weekly red-team prompts.
4. General availability:
   - Release gate mandatory.
   - Incident-to-eval loop mandatory.
   - Monthly threat model review.

### Acceptance Criteria

- Every release has a stored gate report.
- Every production incident links to a regression eval.
- Tool policy changes require security review.

## Phase 14: Roadmap for Continuous Improvement

**Purpose:** keep the MCP layer mature after initial production hardening.

### Future Enhancements

1. Eval dashboard:
   - Trend eval pass rate.
   - Show regressions by tool and attack class.
   - Compare model-in-the-loop graders over time.
2. Policy-as-code:
   - Express scope, approval, and risk policy in one manifest.
   - Generate docs, tests, and tool metadata from it.
3. Semantic safety classifier:
   - Optional model or local classifier for prompt-injection warnings.
   - Run as defense-in-depth, not the only defense.
4. Customer/admin audit UI:
   - Show MCP sessions, tools called, approvals, and connected clients.
   - Allow users to revoke OAuth clients and API keys.
5. Workspace-level security settings:
   - Disable external side effects through MCP.
   - Require admin approval for credential changes.
   - Allowlist outbound domains.
6. Formal red-team exercises:
   - Quarterly attack simulation.
   - Include prompt injection, OAuth abuse, SSRF, tool poisoning, and widget injection.
7. Bug bounty or responsible disclosure:
   - Public security contact.
   - Disclosure policy.
   - Severity matrix.

## Recommended Implementation Order

If the team can only do a few things first, do these:

1. Add Vitest, test fixtures, and CI.
2. Add contract manifest and output schemas for all 28 ChatGPT tools.
3. Approval-gate `execute_workflow_and_wait` and default `execute_workflow`.
4. Confirmation-gate `delete_workflow` and `delete_credential`.
5. Add tenant-isolation tests for every MCP tool.
6. Add OAuth negative-path tests and exact redirect validation in production.
7. Add adversarial prompt-injection and secret-exfiltration evals.
8. Replace in-memory rate limiting before multi-instance production.
9. Add observability and release gate.

## Proposed File and Script Changes

```txt
src/mcp/contracts/
  tools.manifest.ts
  resources.manifest.ts
  prompts.manifest.ts
  schemas.ts

src/mcp/safety/
  approval-guard.ts
  egress-policy.ts

src/mcp/evals/adversarial/
  prompt-injection-cases.ts
  tool-poisoning-cases.ts
  exfiltration-cases.ts
  excessive-agency-cases.ts
  ssrf-cases.ts
  authz-cases.ts

tests/mcp/
  unit/
    sanitize.test.ts
    safety.test.ts
    scope-guard.test.ts
    audit-logger.test.ts
    rate-limiter.test.ts
    api-key.service.test.ts
    oauth.service.test.ts
    webhook-security.test.ts
  integration/
    mcp-route-auth.test.ts
    mcp-tenant-isolation.test.ts
    mcp-tool-workflows.test.ts
    mcp-tool-credentials.test.ts
    mcp-tool-executions.test.ts
    mcp-resources-widgets.test.ts
  contract/
    tool-manifest.test.ts
    output-schema.test.ts
    profile-surface.test.ts
  adversarial/
    prompt-injection.test.ts
    tool-poisoning.test.ts
    ssrf.test.ts

tests/e2e/mcp/
  widgets.spec.ts
  chatgpt-profile.spec.ts

scripts/
  mcp-contract-check.ts
  mcp-adversarial-eval.ts
  mcp-live-eval.ts
  mcp-release-gate.ts
```

## Production Metrics to Track

| Metric | Target |
|---|---:|
| MCP route p95 latency | Less than 800 ms excluding long execution polling |
| Tool call error rate | Less than 1 percent for read tools |
| OAuth token exchange failure rate | Alert above baseline |
| Prompt-injection warning rate | Alert on spike |
| Secret leakage incidents | 0 |
| Cross-tenant incidents | 0 |
| Ungated side-effect executions | 0 |
| Release gate pass rate | 100 percent before production deploy |
| Incident regression coverage | 100 percent of closed production incidents |
| ChatGPT golden prompt pass rate | At least 95 percent |
| Adversarial eval unsafe-call rate | 0 for P0 attacks |

## References

- MCP Security Best Practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- MCP Authorization Specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- OpenAI Apps SDK Security and Privacy: https://developers.openai.com/apps-sdk/guides/security-privacy
- OpenAI Apps SDK Testing: https://developers.openai.com/apps-sdk/deploy/testing
- OWASP Top 10 for LLM and GenAI Apps 2025: https://genai.owasp.org/llm-top-10/
- OWASP LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI 600-1 Generative AI Profile: https://doi.org/10.6028/NIST.AI.600-1

## Final Definition of Done

The MCP system is production mature when:

- Every MCP tool is covered by contract, unit, integration, tenant-isolation, and adversarial tests appropriate to its risk.
- Every app-facing tool has output schema, annotations, examples, and golden prompt coverage.
- Every side-effect and destructive operation is approval-gated or confirmation-gated server-side.
- Every OAuth path has positive and negative tests.
- Prompt-injection, tool-poisoning, secret-exfiltration, and excessive-agency evals run in CI or release gates.
- Production has distributed rate limits, exact CORS/CSP, audit persistence, telemetry, alerts, retention jobs, and feature flags.
- Every production incident becomes a regression eval before closure.
