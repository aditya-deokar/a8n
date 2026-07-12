# Designing a 53-Tool MCP Server That AI Can't Abuse

**Role:** AI Engineer
**Project:** a8n — Open-source workflow automation platform
**Stack:** MCP Server SDK, OAuth 2.1, TypeScript, Prisma, Zod

---

## Quick Facts

| | |
|---|---|
| **Problem** | Opening a SaaS platform to AI agents creates 5 categories of security risk that traditional API security doesn't address |
| **Goal** | Let AI agents build, test, and execute workflows — while guaranteeing they can never perform unauthorized actions, leak credentials, or mutate production data without human consent |
| **Constraints** | Zero friction for read-only operations, explicit consent only for destructive/side-effect operations, must work across different AI clients with different trust levels |
| **What Changed** | Designed a 7-layer security architecture with approval gates, scoped permissions, app profiles, sensitive data rejection, and structured audit logging |
| **Biggest Challenge** | Finding the right boundary between AI agency and human control — too restrictive makes the system useless, too permissive makes it dangerous |
| **What I Learned** | AI agents are not malicious — they're non-deterministic. Security isn't about blocking them; it's about designing a trust gradient where risk scales with the required level of human consent |

---

## The Hero

This case study is about **the platform and its existing users** — the people whose workflows, credentials, and data are at risk the moment you expose 53 tools to an AI agent.

When I built the MCP layer for a8n (covered in the companion case study), I solved the accessibility problem. Users could finally build workflows through natural language.

But I'd also opened a door. And I needed to make sure nothing walked through it that shouldn't.

---

## The Problem

Here's the uncomfortable truth about MCP servers:

**Every tool you expose to an AI agent is a tool the AI can misuse.**

Not because the AI is malicious. Because it's **non-deterministic**. LLMs hallucinate parameters, skip safety steps, and don't inherently understand business context.

I had 53 tools. Some were harmless (read a list of workflows). Some could cause real damage (delete a workflow, execute a workflow that sends emails, overwrite a production graph).

The default MCP server SDK gives you: tool registration, transport, and parameter validation. That's it. **No auth. No approval gates. No audit trail. No rate limiting.**

If I shipped the server as-is, here's what could go wrong:

```
┌──────────────────────────────────────────────────────────────────┐
│              5 THREAT VECTORS FOR AI-EXPOSED TOOLS               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. UNAUTHORIZED MUTATION                                        │
│     AI calls delete_workflow without user consent.               │
│     Result: Production workflow gone. Execution history lost.    │
│                                                                  │
│  2. CREDENTIAL LEAKAGE                                           │
│     User pastes API key into chat: "use this key: sk-abc123"    │
│     AI stores it in workflow draft → visible in plain text.      │
│     Result: Secret exposed in conversation logs.                 │
│                                                                  │
│  3. HALLUCINATED CONFIGURATION                                   │
│     AI guesses a Handlebars template incorrectly:               │
│     {{googleForm.email}} instead of                              │
│     {{googleForm.respondentEmail}}                               │
│     Result: Workflow runs but sends to wrong address.            │
│                                                                  │
│  4. SCOPE ESCALATION                                             │
│     API key with read-only scope calls execute_workflow.         │
│     Without scope enforcement, it succeeds.                      │
│     Result: Unauthorized workflow execution.                     │
│                                                                  │
│  5. INVISIBLE SIDE EFFECTS                                       │
│     AI calls execute_workflow (which sends real emails,          │
│     posts to real Slack channels) without the user               │
│     understanding what will happen.                              │
│     Result: Unintended real-world consequences.                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Traditional API security (API keys, rate limiting) handles some of this. But AI agents introduce problems that traditional callers don't have: **they don't understand consequences, they fill parameters based on probability, and they can't be held accountable.**

This required a different approach.

---

## The Stakes

The consequences of getting this wrong aren't hypothetical:

- **One unguarded `delete_workflow` call** = permanently destroyed production workflow + all execution history
- **One credential leaked in chat** = API key visible in conversation logs, possibly stored by the AI provider
- **One unauthorized `execute_workflow` call** = real emails sent, real Slack messages posted, real Stripe webhooks triggered
- **Repeated abuse without detection** = no audit trail means you can't even identify what happened

And the stakes compound with scale. If 1,000 users connect their AI clients, you're exposing 53,000 tool surfaces. Every one needs to be safe.

---

## My Role

I was the AI engineer responsible for designing the **trust architecture** between AI agents and the platform. This meant:

1. **Threat modeling** — Identifying what can go wrong when non-deterministic callers interact with deterministic systems
2. **Architecture design** — Building the security layers (not just adding auth headers)
3. **System implementation** — Writing the middleware, guards, and contracts
4. **Trade-off management** — Keeping the system frictionless for safe operations while making dangerous operations require explicit consent

The goal wasn't to make the system "secure" in the checkbox sense. It was to build a **trust gradient** — where the level of human involvement scales proportionally with the risk of the operation.

---

## The Journey

### Phase 1: Classifying Every Tool by Risk

Before writing a single line of security code, I classified every tool in the system by risk level:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TOOL RISK CLASSIFICATION                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SAFE READ (no consent needed)                                       │
│  ─────────────────────────────                                       │
│  • list_workflows, get_workflow                                      │
│  • list_node_types, search_capabilities                              │
│  • whoami, server_info, health_check                                 │
│  • explain_workflow, plan_workflow_from_goal                         │
│  → AI can call these freely. Zero risk.                              │
│                                                                      │
│  SAFE WRITE (consent via scope, not per-call)                        │
│  ─────────────────────────────────────────────                       │
│  • create_workflow_draft                                             │
│  • answer_workflow_draft_questions                                   │
│  • validate_workflow_draft                                           │
│  → Creates sandbox data only. Never touches live workflows.          │
│                                                                      │
│  APPROVAL-GATED WRITE (needs explicit human consent)                 │
│  ───────────────────────────────────────────────────                  │
│  • apply_workflow_draft                                              │
│  • execute_workflow                                                  │
│  • test_webhook_setup (triggers real external calls)                 │
│  → Mutates production data or triggers external side effects.        │
│  → Requires: approved=true + preview shown to user.                  │
│                                                                      │
│  DESTRUCTIVE / ADMIN (needs consent + confirmation hash)             │
│  ─────────────────────────────────────────────────────                │
│  • delete_workflow (permanent, irreversible)                         │
│  • Full graph replacement via update_workflow                        │
│  → Requires: approved=true + confirmationHash matching the           │
│    preview payload. AI cannot forge or skip the hash.                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Every tool in the system has a **contract** — a metadata declaration that specifies its required scope, risk level, whether it has external side effects, and whether it's destructive. This contract drives all downstream security enforcement automatically.

### Phase 2: The 7-Layer Security Architecture

The classification drives the architecture. Each layer addresses a specific threat vector:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    7-LAYER SECURITY STACK                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  REQUEST ARRIVES                                                     │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 1: AUTHENTICATION            │  "Who are you?"             │
│  │  • OAuth 2.1 with PKCE              │  Blocks anonymous access.   │
│  │  • API key with HMAC verification   │  Links every request to a   │
│  │  • Bearer token middleware          │  specific user identity.    │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 2: RATE LIMITING             │  "How often?"               │
│  │  • Per-user, per-minute throttle    │  Prevents AI agents from    │
│  │  • Free: 30 req/min                 │  flooding the system.       │
│  │  • Pro: 120 req/min                 │  DB-backed in production.   │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 3: SCOPE ENFORCEMENT         │  "Are you allowed?"         │
│  │  • 8 granular permission scopes     │  Read-only API key can't    │
│  │  • Every tool declares its scope    │  call execute_workflow.     │
│  │  • Wildcard (*) for full access     │  Scope mismatch = blocked.  │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 4: APPROVAL GUARD            │  "Did the human say yes?"   │
│  │  • Risky tools need approved=true   │  The AI must show a         │
│  │  • Destructive tools also need a    │  preview, explain the       │
│  │    confirmationHash from the        │  consequences, and pass     │
│  │    preview step                     │  the hash the user saw.     │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 5: SENSITIVE DATA REJECTION  │  "Is this safe to accept?"  │
│  │  • Scans input for secret-looking   │  Users can't accidentally   │
│  │    values: "password", "apiKey",    │  paste API keys into chat.  │
│  │    "token", "secret", "rawKey"      │  System refuses and         │
│  │  • Throws error + directs user to   │  redirects to credential    │
│  │    credential dashboard             │  dashboard.                 │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 6: ERROR BOUNDARY            │  "Did something break?"     │
│  │  • Wraps every tool in try/catch    │  Prevents stack traces      │
│  │  • Sanitizes error output           │  from leaking to AI.        │
│  │  • Never exposes internal paths     │  Returns clean, structured  │
│  │    or database details              │  error messages.            │
│  └──────────────┬──────────────────────┘                             │
│                 ▼                                                     │
│  ┌─────────────────────────────────────┐                             │
│  │  Layer 7: AUDIT LOGGING             │  "What happened?"           │
│  │  • Every tool call logged:          │  Full forensic trail.       │
│  │    userId, tool, input, result      │  Anomaly detection with     │
│  │  • Approval events tracked          │  configurable thresholds    │
│  │    separately                       │  for auth failures, prompt  │
│  │  • DB-persisted for compliance      │  injection, rate bursts.    │
│  └─────────────────────────────────────┘                             │
│                                                                      │
│  TOOL EXECUTES                                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Every request passes through all 7 layers. No exceptions. No shortcuts.

---

## The Turning Point

The key insight came while designing the approval guard.

My first attempt was simple: add `requiresApproval: true` to dangerous tools and block them unless the AI passed `approved: true`. But this has a fatal flaw:

> **The AI can just set `approved: true` by itself. There's no proof that the user actually consented.**

Setting a boolean to true isn't consent. It's a parameter. The AI can hallucinate it.

The solution was a **cryptographic confirmation workflow:**

```
┌──────────────────────────────────────────────────────────────────────┐
│            THE APPROVAL GUARD FLOW                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FIRST CALL (AI tries to execute without approval):                  │
│  ─────────────────────────────────────────────────                   │
│  AI → delete_workflow({ id: "wf_123", approved: false })            │
│       │                                                              │
│       ▼                                                              │
│  Approval Guard:                                                     │
│  1. Looks up tool contract → risk: "admin_or_destructive"           │
│  2. approved !== true → BLOCK                                        │
│  3. Computes confirmationHash from payload:                          │
│     SHA-256({ toolName, workflowId, workflowName, irreversible })   │
│  4. Returns preview to AI:                                           │
│     {                                                                │
│       "approvalRequired": true,                                      │
│       "workflowName": "customer-feedback-pipeline",                  │
│       "irreversible": true,                                          │
│       "confirmationHash": "a3f2c1e8...",                            │
│       "warning": "Permanently removes graph and history.",           │
│       "instruction": "Call with approved: true and this hash        │
│                       after user approval."                          │
│     }                                                                │
│                                                                      │
│  AI SHOWS PREVIEW TO USER:                                           │
│  ─────────────────────────                                           │
│  "I need your approval to delete 'customer-feedback-pipeline'.      │
│   This will permanently remove the workflow and its history.         │
│   This action cannot be undone. Should I proceed?"                   │
│                                                                      │
│  USER: "Yes, delete it."                                             │
│                                                                      │
│  SECOND CALL (with approval + hash):                                 │
│  ────────────────────────────────────                                │
│  AI → delete_workflow({                                              │
│    id: "wf_123",                                                     │
│    approved: true,                                                   │
│    confirmationHash: "a3f2c1e8..."                                  │
│  })                                                                  │
│       │                                                              │
│       ▼                                                              │
│  Approval Guard:                                                     │
│  1. approved === true ✓                                              │
│  2. Re-computes expected hash from current payload                   │
│  3. Compares: provided hash === expected hash ✓                     │
│  4. If the workflow changed between calls, the hash won't match     │
│     → BLOCKED (tamper protection)                                    │
│  5. Hash matches → PROCEED                                          │
│  6. Logs: "approval_accepted" with full audit context                │
│                                                                      │
│  Tool executes. Workflow deleted.                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The hash is computed from the **action payload**, not from a static secret. If the workflow is modified between the preview and the approval, the hash won't match. The AI can't forge the hash because it's derived from server-side data.

This is the mechanism that makes the entire system trustworthy.

---

## The Solution (Deep Dives)

### 1. The Permission Scope System

Every API key and OAuth token carries a set of scopes. Every tool declares which scope it requires. The scope guard middleware enforces the match before the tool body ever runs.

```
┌──────────────────────────────────────────────────────────────────┐
│                    8 PERMISSION SCOPES                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  workflows:read     → List, get, explain workflows               │
│  workflows:write    → Create, update, rename, delete workflows   │
│  workflows:execute  → Trigger workflow executions                 │
│  credentials:read   → Read credential metadata (not values)      │
│  credentials:write  → Create, update, delete credentials         │
│  executions:read    → Read execution history and results         │
│  system:read        → Server info, node types, user profile      │
│  api_keys:manage    → Create, list, revoke API keys              │
│  *                  → Wildcard: full access                      │
│                                                                  │
│  Default scopes for new API keys:                                │
│  [workflows:read, credentials:read, executions:read, system:read]│
│  → Read-only by default. Write access is opt-in.                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

A read-only API key cannot call `execute_workflow` — no matter what the AI tries. The scope guard rejects it before the function body is reached.

### 2. Sensitive Data Rejection

When users interact with AI, they sometimes paste secrets directly into chat: *"Here's my API key: sk-abc123..."*

The AI then passes this value into `answer_workflow_draft_questions`. If the system accepts it, the secret ends up stored in a draft record — visible in the database, possibly in AI provider logs.

The solution: every answer is scanned for sensitive-looking keys before being accepted.

```
┌──────────────────────────────────────────────────────────────────┐
│             SENSITIVE DATA REJECTION                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Blocked key patterns:                                           │
│  "value", "secret", "password", "token",                         │
│  "apiKey", "rawKey", "webhookUrl"                                │
│                                                                  │
│  How it works:                                                   │
│  1. Recursively scans all keys in the answers object             │
│  2. If any key name matches a sensitive pattern → REJECT         │
│  3. Throws error:                                                │
│     "Refusing to accept sensitive value at answers.apiKey.       │
│      Use the dashboard or credential tools for secrets."         │
│  4. The AI receives the error and tells the user:                │
│     "I can't accept API keys in chat. Please add your            │
│      Gemini key in the a8n credential dashboard."                │
│                                                                  │
│  This is a PROACTIVE defense — the system refuses secrets        │
│  even if the user volunteers them willingly.                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3. The App Profile System

Different AI clients have different trust levels. A developer using the API directly is different from a consumer using ChatGPT.

The app profile system controls which tools each client type can access:

```
┌──────────────────────────────────────────────────────────────────────┐
│             APP PROFILE: TOOL SURFACE CONTROL                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  REQUEST ARRIVES                                                     │
│       │                                                              │
│       ▼                                                              │
│  Detect app profile (from env, header, or OAuth client metadata)     │
│       │                                                              │
│       ├──► profile = "default" → Register ALL 53 tools               │
│       │    (Full CRUD, API key mgmt, audit logs, raw graph ops)      │
│       │                                                              │
│       └──► profile = "chatgpt" → Register CURATED 25 tools          │
│            ✅ Draft-based creation (plan, create, validate, apply)   │
│            ✅ Execution + debugging (run, test, diagnose, fix)       │
│            ✅ Integration setup (checklist, guides, testing)         │
│            ✅ Rich rendering tools (visual previews in chat)         │
│            ❌ Raw create_workflow / update_workflow                   │
│            ❌ delete_workflow                                         │
│            ❌ API key management                                      │
│            ❌ Direct credential CRUD                                  │
│            ❌ Audit log access                                        │
│                                                                      │
│  + Runtime kill switch:                                              │
│    Set MCP_FORCE_READ_ONLY_CHATGPT_PROFILE=true                     │
│    → Even draft creation tools are removed.                          │
│    → ChatGPT profile becomes fully read-only.                        │
│    → No restart needed. Takes effect on next request.                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

This means a consumer-facing ChatGPT app can **build, test, and run workflows** but cannot accidentally delete production data or access raw credential values. And if something goes wrong, a single environment variable makes the entire consumer surface read-only without redeploying.

### 4. Audit Logging and Anomaly Detection

Every tool call generates an audit record. But logging alone isn't enough — you need to detect patterns that indicate abuse.

```
┌──────────────────────────────────────────────────────────────────────┐
│             AUDIT LOGGING + ANOMALY DETECTION                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Every tool call logs:                                               │
│  ┌──────────────────────────────────────────────────┐                │
│  │  userId          │  Who called it                │                │
│  │  apiKeyId        │  Which API key was used       │                │
│  │  authMethod      │  OAuth or API key?            │                │
│  │  tool            │  Tool name                    │                │
│  │  input           │  Arguments (sanitized)        │                │
│  │  result          │  success / error              │                │
│  │  timestamp       │  When                         │                │
│  └──────────────────────────────────────────────────┘                │
│                                                                      │
│  Anomaly thresholds (per 5-minute window):                           │
│  ┌──────────────────────────────────────────────────┐                │
│  │  Auth failures          │  > 20 → ALERT          │                │
│  │  Scope denials          │  > 20 → ALERT          │                │
│  │  Prompt injection       │  > 5  → ALERT          │                │
│  │  Approval bypass        │  > 3  → ALERT          │                │
│  │  Tool error rate        │  > 10% → ALERT         │                │
│  │  Rate limit denials     │  > 25 → ALERT          │                │
│  │  OAuth token errors     │  > 10 → ALERT          │                │
│  │  Audit persist failures │  > 1  → ALERT          │                │
│  └──────────────────────────────────────────────────┘                │
│                                                                      │
│  Approval events are tracked separately:                             │
│  • "approval_requested" — AI asked for permission                    │
│  • "approval_accepted" — User granted permission + hash matched      │
│  Both include full context for forensic reconstruction.              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5. The Tool Contract System

Every tool has a machine-readable contract that declares its risk profile. This contract is the single source of truth for all security decisions:

```
┌──────────────────────────────────────────────────────────────────┐
│             TOOL CONTRACT (example: delete_workflow)             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  {                                                               │
│    name: "delete_workflow",                                      │
│    requiredScope: "workflows:write",                             │
│    risk: "admin_or_destructive",                                 │
│    requiresApproval: true,                                       │
│    destructive: true,                                            │
│    externalSideEffect: false,                                    │
│    readOnly: false,                                              │
│  }                                                               │
│                                                                  │
│  The approval guard reads this contract at call time:            │
│  • destructive=true → requires confirmationHash                  │
│  • requiresApproval=true → requires approved=true                │
│  • risk="admin_or_destructive" → extra audit logging             │
│                                                                  │
│  Adding a new tool? Define its contract. All security            │
│  enforcement follows automatically.                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

This system means security isn't bolted on per-tool. It's **declarative.** You write the contract, and the middleware stack handles enforcement. New tools inherit the right security posture by declaring their risk level.

---

## The Results

### The Mental Model: Staged Trust

The entire architecture follows a principle I call **staged trust**:

```
┌──────────────────────────────────────────────────────────────────┐
│                    STAGED TRUST                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RISK LEVEL          HUMAN INVOLVEMENT          FRICTION         │
│  ──────────          ──────────────────          ────────         │
│                                                                  │
│  Read-only           None                       Zero             │
│  (list, get,         AI calls freely.            No approval,     │
│   explain)           No consent needed.          no hash.         │
│                          │                                       │
│                          ▼                                       │
│  Safe write          Scope-level                 Low              │
│  (create draft,      API key must have           Scope check      │
│   validate)          write permission.           only.            │
│                          │                                       │
│                          ▼                                       │
│  Side-effect         Per-call approval           Medium           │
│  write               AI must show preview.       User says        │
│  (execute,           User must say "yes."        "yes."           │
│   test webhook)          │                                       │
│                          ▼                                       │
│  Destructive         Approval +                  High             │
│  (delete,            confirmation hash.          Preview +        │
│   full replace)      Hash proves user saw        consent +        │
│                      the exact action.           hash.            │
│                                                                  │
│  Trust increases → friction increases.                           │
│  Low-risk operations stay frictionless.                          │
│  High-risk operations require proof of human consent.            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Security Coverage

```
┌──────────────────────┬──────────────────────────┬────────────────┐
│  Threat Vector        │  Defense Layer           │  Status        │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Unauthenticated     │  OAuth 2.1 / API key     │  ✅ Blocked    │
│  access              │  + bearer middleware      │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Scope escalation    │  8 granular scopes       │  ✅ Blocked    │
│                      │  + scope guard           │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Unauthorized        │  Approval guard +        │  ✅ Blocked    │
│  mutation            │  confirmation hash       │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Credential leakage  │  Sensitive data          │  ✅ Blocked    │
│  via chat            │  rejection               │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Rate abuse          │  Per-user, per-minute    │  ✅ Throttled  │
│                      │  rate limiter            │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Error information   │  Error boundary +        │  ✅ Sanitized  │
│  leakage             │  output sanitization     │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Undetected abuse    │  Structured audit logs   │  ✅ Monitored  │
│  patterns            │  + anomaly thresholds    │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Over-exposed tool   │  App profiles with       │  ✅ Controlled │
│  surface             │  runtime kill switch     │                │
├──────────────────────┼──────────────────────────┼────────────────┤
│  Hallucinated tool   │  Zod schema validation   │  ✅ Rejected   │
│  parameters          │  on every tool call      │                │
└──────────────────────┴──────────────────────────┴────────────────┘
```

### Quantitative Summary

| Metric | Value |
|---|---|
| Total tools exposed | 53 (full profile), 25 (ChatGPT profile) |
| Unguarded destructive operations | 0 |
| Tools with declared risk contracts | 53 / 53 (100%) |
| Permission scopes | 8 granular + 1 wildcard |
| Anomaly detection thresholds | 8 categories |
| Security layers per request | 7 |
| Time to switch ChatGPT profile to read-only | 0 (env flag, no restart) |

---

## Reflection

### What I Learned

**1. AI agents aren't malicious — they're non-deterministic.** The security model should account for unintended behavior (hallucination, parameter guessing), not just intentional attacks. This means defenses like the confirmation hash matter more than firewalls.

**2. The approval guard is the highest-leverage security feature.** It's the only mechanism that creates a verifiable chain: server generates hash from real data → AI shows preview to user → user consents → AI passes hash back → server re-verifies. Every other layer (scopes, rate limiting) supports this one.

**3. Declarative security scales.** Writing a contract for each tool (risk level, required scope, side effects) and letting middleware handle enforcement means adding tool #54 is just as safe as tool #1. No per-tool security code.

**4. App profiles solve the "one server, many audiences" problem.** A developer needs 53 tools. A consumer needs 25. A compromised client needs 0 (read-only kill switch). One codebase, three postures.

**5. Audit logging is not optional — it's the insurance policy.** When something goes wrong (and it will), the audit trail is the only way to reconstruct what happened. Structured, DB-persisted logs with anomaly detection thresholds are the minimum for any AI-exposed system.

### What I'd Improve

- **Per-tool rate limiting** — Currently rate limiting is per-user. High-risk tools like `execute_workflow` should have stricter per-tool limits.
- **Semantic input classification** — The sensitive data rejection currently uses key-name matching. A lightweight classifier could catch secrets even when the key name is obfuscated.
- **Replay protection** — Adding nonces to approval hashes to prevent replay attacks in long-lived sessions.

### The Takeaway for AI Engineers

If you're building an MCP server — or any interface between AI agents and a production system — start with this question:

> **"What happens if the AI calls this tool with the worst possible parameters, at the worst possible time, without the user knowing?"**

If the answer is "nothing bad," the tool is safe. Ship it without friction.

If the answer is "something irreversible," build the approval guard first. Everything else is optimization.

---

> **Companion case study:** [How I Gave 80% of Users Access to a Workflow Automation Platform — Without Teaching Them a Single UI ←](#)
> *The product vision: why the MCP layer exists and how it expanded the platform's addressable audience from 20% to 100%.*
