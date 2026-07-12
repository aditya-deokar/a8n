# The UI That Kills Workflow Tools Isn't the Canvas — It's the Configuration Screen

*Part 3 of the a8n deep-dive series.*

---

Last week, I broke down how a8n's execution engine works — topological sorting, durable execution with Inngest, real-time status.

But here's the uncomfortable truth I discovered while building it:

**The execution engine is the hardest part to build. But the configuration screen is the hardest part to use.**

I built a drag-and-drop canvas. A node editor. A credential vault. Webhook URLs. JSON body templates with Handlebars syntax.

And then I watched someone try to use it.

They didn't know what an HTTP method was.
They didn't know what `{{googleForm.respondentEmail}}` meant.
They couldn't find their Gemini API key.
They gave up in 3 minutes.

That's when I realized: the product wasn't hard to build — it was hard to **use**.

And that's the villain of every workflow tool.

---

## The Villain: The Configuration Wall

Every workflow automation tool — n8n, Zapier, Make — eventually hits the same problem:

```
┌──────────────────────────────────────────────────────────────────┐
│                    THE CONFIGURATION WALL                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  A user wants:                                                   │
│  "When someone fills out my Google Form,                         │
│   summarize it with AI and email them back."                     │
│                                                                  │
│  What they have to do:                                           │
│                                                                  │
│  1. Know that this requires 3 separate nodes                     │
│  2. Find the Google Form Trigger node                            │
│  3. Configure a webhook URL                                      │
│  4. Copy that URL to Google Apps Script                          │
│  5. Write a Google Apps Script trigger                           │
│  6. Find the Gemini node                                         │
│  7. Get a Gemini API key from console.cloud.google.com           │
│  8. Create a credential in the vault                             │
│  9. Link the credential to the node                              │
│  10. Write a Handlebars prompt template:                         │
│      "Summarize: {{json googleForm.responses}}"                  │
│  11. Configure the Email node with SMTP settings                 │
│  12. Set the "to" field: {{googleForm.respondentEmail}}          │
│  13. Set the body to {{geminiResult.text}}                       │
│  14. Connect all 3 nodes with edges                              │
│  15. Save the workflow                                           │
│  16. Click Run                                                   │
│  17. Debug when it inevitably fails the first time               │
│                                                                  │
│  Steps that require technical knowledge: 15 out of 17            │
│  Steps a normal user can do: 2 (steps 1 and 16)                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

This is the reality of **every** visual workflow tool.

The canvas makes it look easy.
The configuration makes it impossible for 80% of users.

---

## The Solution: Let AI Do the Configuration

What if the user could just say:

> "When someone fills out my Google Form, summarize the response with Gemini AI, and email the respondent with the summary."

And the system builds the entire workflow — nodes, edges, credentials, templates — automatically?

That's exactly what I built using **MCP (Model Context Protocol)**.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   TRADITIONAL UX                  MCP-POWERED UX                 │
│   ──────────────                  ──────────────                 │
│                                                                  │
│   User → Canvas → Configure →     User → "I want..." →          │
│   Debug → Fix → Configure →       AI plans → AI builds →        │
│   Test → Fail → Google →          AI validates → User approves → │
│   Fix again → Test → Success      Done ✓                        │
│                                                                  │
│   Time: 45+ minutes               Time: 2 minutes               │
│   Knowledge required: High        Knowledge required: None       │
│   Drop-off rate: ~70%             Drop-off rate: ~5%            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## What is MCP? (30-Second Version)

MCP (Model Context Protocol) is an open standard by Anthropic that lets AI models interact with external tools and services.

Think of it as a **USB-C port for AI apps.**

Instead of every AI client building custom integrations with every platform, MCP provides one standard interface:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Without MCP:                                                   │
│  ─────────────                                                  │
│  ChatGPT ──custom API──► Zapier                                 │
│  Claude  ──custom API──► Make                                   │
│  Cursor  ──custom API──► n8n                                    │
│  (N clients × M platforms = N×M integrations)                   │
│                                                                 │
│  With MCP:                                                      │
│  ──────────                                                     │
│  ChatGPT ──┐                    ┌──► Zapier (MCP server)        │
│  Claude  ──┼── MCP Protocol ────┼──► a8n (MCP server)           │
│  Cursor  ──┘                    └──► n8n (MCP server)           │
│  (N clients × 1 protocol × M platforms = N+M integrations)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

a8n exposes an **MCP server** with **53 tools**, **6 resources**, and **3 guided prompts** — so any MCP-compatible AI client can build, configure, execute, debug, and manage workflows through natural conversation.

---

## How It Actually Works (End to End)

Here's what happens when a non-technical user talks to an AI client connected to a8n's MCP server:

```
┌─────────────────────────────────────────────────────────────────────────┐
│          FROM ENGLISH SENTENCE TO RUNNING WORKFLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User: "When a Google Form is submitted, summarize it with              │
│         Gemini and email the respondent."                               │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 1: plan_workflow_from_goal              │                       │
│  │  AI parses the goal and maps it to:           │                       │
│  │  • Trigger: GOOGLE_FORM_TRIGGER               │                       │
│  │  • AI node: GEMINI                            │                       │
│  │  • Output: EMAIL                              │                       │
│  │  • Required apps: Google Forms, Gemini, SMTP  │                       │
│  │  • Risks: "Can send email to real people"     │                       │
│  │  • Effort: medium                             │                       │
│  │  • Template: "google-form-ai-email"           │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 2: create_workflow_draft                │                       │
│  │  Creates a DRAFT (not a live workflow) with:  │                       │
│  │  • 3 nodes auto-positioned on canvas          │                       │
│  │  • Edges connecting them in sequence           │                       │
│  │  • Default Handlebars templates pre-filled     │                       │
│  │  • Missing fields identified automatically     │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 3: answer_workflow_draft_questions       │                       │
│  │  AI fills non-sensitive fields:               │                       │
│  │  • Email subject, prompt wording, etc.        │                       │
│  │  ⛔ REFUSES to accept secrets via chat:       │                       │
│  │     API keys, passwords, tokens               │                       │
│  │  → Directs user to credential dashboard       │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 4: validate_workflow_draft              │                       │
│  │  Checks for:                                  │                       │
│  │  • Missing required fields                    │                       │
│  │  • Credential compatibility                   │                       │
│  │  • Graph cycles                               │                       │
│  │  • Unreachable nodes                          │                       │
│  │  • Duplicate variable names                   │                       │
│  │  • Side-effect warnings                       │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 5: explain_workflow                     │                       │
│  │  Returns beginner-friendly explanation:       │                       │
│  │  "When someone submits your Google Form,      │                       │
│  │   this workflow will:                         │                       │
│  │   1. Receive the form data                    │                       │
│  │   2. Send it to Gemini AI for a summary       │                       │
│  │   3. Email the summary to the respondent"     │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 6: preview_workflow_diff                │                       │
│  │  Shows what will change:                      │                       │
│  │  • Added nodes, removed nodes, changed data   │                       │
│  │  • Side effects and rollback plan             │                       │
│  │  • Confirmation hash for approval             │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 7: User approves ✓                      │                       │
│  │  → apply_workflow_draft(approved: true,       │                       │
│  │     confirmationHash: "a3f2c1...")             │                       │
│  │  • Creates version snapshot for rollback       │                       │
│  │  • Atomically replaces workflow graph          │                       │
│  └────────────────────┬─────────────────────────┘                       │
│                       ▼                                                 │
│  ┌──────────────────────────────────────────────┐                       │
│  │  Step 8: execute_workflow_and_wait             │                       │
│  │  Triggers via Inngest → Returns results       │                       │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
│  Total technical knowledge required from user: ZERO                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The user never touched the canvas.
The user never wrote Handlebars syntax.
The user never configured a webhook URL.
The AI did all of it — through a8n's MCP tools.

---

## The 53 Tools Behind the Scenes

a8n's MCP server isn't a toy. It's a full-featured API organized into 7 domains:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    a8n MCP SERVER: 53 TOOLS                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📋 WORKFLOWS (23 tools)                                             │
│  ────────────────────────                                            │
│  • create_workflow, list_workflows, get_workflow                     │
│  • update_workflow, rename_workflow, delete_workflow                  │
│  • execute_workflow                                                  │
│  • plan_workflow_from_goal         ← Natural language planning       │
│  • create_workflow_draft           ← Safe sandbox creation           │
│  • answer_workflow_draft_questions ← Fill non-sensitive fields       │
│  • validate_workflow_draft         ← Graph + credential checks       │
│  • explain_workflow                ← Beginner-friendly explanation   │
│  • preview_workflow_diff           ← Show changes before applying    │
│  • apply_workflow_draft            ← Approval-gated deployment       │
│  • Version management tools (snapshot, restore, compare)             │
│                                                                      │
│  🔐 CREDENTIALS (6 tools)                                           │
│  ────────────────────────                                            │
│  • list, get, create, update, delete                                 │
│  • list_credentials_by_type                                          │
│                                                                      │
│  ▶️  EXECUTIONS (8 tools)                                            │
│  ────────────────────────                                            │
│  • list_executions, get_execution                                    │
│  • execute_workflow_and_wait       ← Synchronous chat UX             │
│  • run_workflow_test               ← Test with sample data           │
│  • get_execution_timeline          ← Step-by-step replay             │
│  • diagnose_execution              ← Root cause analysis             │
│  • suggest_workflow_fix            ← AI-powered fix suggestions      │
│  • apply_workflow_fix              ← Auto-repair broken workflows    │
│                                                                      │
│  🧩 NODES (2 tools)                                                 │
│  ────────────────────                                                │
│  • list_node_types                 ← All supported node types        │
│  • search_capabilities             ← "What can a8n do with Slack?"   │
│                                                                      │
│  🔧 SYSTEM (5 tools)                                                │
│  ────────────────────                                                │
│  • whoami, server_info, health_check                                 │
│  • security_status, audit_log                                        │
│                                                                      │
│  🔑 API KEYS (3 tools)                                              │
│  ────────────────────                                                │
│  • create, list, revoke                                              │
│                                                                      │
│  🔗 INTEGRATIONS (6 tools)                                          │
│  ─────────────────────────                                           │
│  • get_workflow_setup_checklist    ← What's missing?                 │
│  • get_integration_setup_guide     ← Step-by-step for any service    │
│  • get_webhook_url                 ← Auto-generate webhook URLs      │
│  • generate_google_form_script     ← Auto-write Apps Script          │
│  • test_webhook_setup              ← Sample data test runs           │
│  • test_credential                 ← Validate without exposing keys  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Plus **6 resources** (node catalogs, credential types, workflow schemas, API docs) and **3 guided prompts** (create workflow, setup integration, debug execution) that teach the AI how to use the tools properly.

---

## Real Use Cases (Not Hypotheticals)

### Use Case 1: Google Form → AI Summary → Email

```
User says:   "Auto-respond to my feedback form with a Gemini summary"
MCP does:    plan → draft → validate → explain → approve → execute
Result:      3-node workflow running in production, zero code written
```

### Use Case 2: Stripe Payment → Slack Alert

```
User says:   "Notify my team in Slack when someone pays"
MCP does:    plan → draft → validate → explain → approve → execute
Result:      Stripe webhook + Slack notification, zero configuration
```

### Use Case 3: Debug a Failed Workflow

```
User says:   "My workflow failed, what happened?"
MCP does:    diagnose_execution → get_execution_timeline →
             suggest_workflow_fix → apply_workflow_fix
Result:      Root cause found, fix suggested, auto-applied after approval
```

### Use Case 4: "What Can a8n Do?"

```
User says:   "Can a8n do anything with Google Sheets?"
MCP does:    search_capabilities("Google Sheets") →
             Returns: GOOGLE_SHEETS node, required credential type,
             setup guide, example workflows
```

---

## How MCP Fits in the a8n Architecture

MCP isn't a replacement for the canvas — it's a **parallel entry point** for a different audience:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     a8n DUAL ENTRY POINTS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TECHNICAL USERS                      NON-TECHNICAL USERS               │
│  ─────────────────                    ────────────────────              │
│                                                                         │
│  ┌──────────────┐                     ┌──────────────────┐              │
│  │  React Canvas │                     │  AI Chat Client  │              │
│  │  (Dashboard)  │                     │  (ChatGPT, Claude│              │
│  │              │                     │   Cursor, etc.)  │              │
│  └──────┬───────┘                     └────────┬─────────┘              │
│         │                                      │                        │
│         │  tRPC                                 │  MCP Protocol          │
│         │                                      │  (Streamable HTTP)     │
│         ▼                                      ▼                        │
│  ┌──────────────────────────────────────────────────────┐               │
│  │                 a8n Backend                           │               │
│  │                                                      │               │
│  │  ┌─────────────┐        ┌──────────────────────┐     │               │
│  │  │ tRPC Router  │        │  MCP Server           │     │               │
│  │  │ (mutations,  │        │  (53 tools,           │     │               │
│  │  │  queries)    │        │   6 resources,         │     │               │
│  │  └──────┬──────┘        │   3 prompts)           │     │               │
│  │         │               └──────────┬─────────────┘     │               │
│  │         │                          │                   │               │
│  │         └──────────┬───────────────┘                   │               │
│  │                    ▼                                   │               │
│  │         ┌──────────────────────┐                       │               │
│  │         │  Shared Core         │                       │               │
│  │         │  • Prisma DB         │                       │               │
│  │         │  • Inngest Engine    │                       │               │
│  │         │  • Credential Vault  │                       │               │
│  │         │  • Executor Registry │                       │               │
│  │         └──────────────────────┘                       │               │
│  │                                                      │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                         │
│  Same execution engine. Same database. Same credentials.                │
│  Different interface. Different audience.                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

A workflow created via MCP shows up on the canvas.
A workflow created on the canvas is accessible via MCP.
They share the same engine, the same database, the same Inngest pipeline.

---

## The Draft Lifecycle: Safety Without Friction

The most important design decision in the MCP layer is the **draft system**.

AI models shouldn't directly mutate production workflows. Instead, every workflow goes through a **staged lifecycle with human approval gates**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DRAFT LIFECYCLE                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐  │
│  │  PLAN  │ ──►  │  DRAFT   │ ──►  │  READY   │ ──►  │ APPLIED  │  │
│  └────────┘      └──────────┘      └──────────┘      └──────────┘  │
│  Read-only       Mutable           Validated          Live          │
│  No side         Safe sandbox      All fields ok      On canvas     │
│  effects         Revision history  Credentials ok     Executable    │
│                  Sensitive data     Graph is valid                   │
│                  rejection                                          │
│                                                                      │
│  Gate:           Gate:             Gate:              Gate:          │
│  None            Validation        Approval hash      Inngest       │
│                  errors            + explicit          execution     │
│                                    user consent                     │
│                                                                      │
│  Every stage creates a draft revision for audit trail.               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

This means:
- The AI can **plan** and **draft** freely (no damage possible)
- The AI **cannot apply** without the user saying "yes"
- Every draft change is **versioned and reversible**
- Sensitive data (API keys, passwords) is **automatically rejected** via chat — users must use the credential dashboard

---

## The ChatGPT App Profile: MCP for the Masses

Not every AI client needs all 53 tools. A consumer using ChatGPT needs a **curated, safer subset.**

a8n has a dedicated `chatgpt` app profile that exposes only 25 tools:

```
┌──────────────────────────────────────────────────────────────────┐
│             CHATGPT APP PROFILE (25 tools)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ INCLUDED (safe for consumer use)                             │
│  ───────────────────────────────────                             │
│  • plan_workflow_from_goal                                       │
│  • create_workflow_draft                                         │
│  • validate/explain/preview/apply drafts                         │
│  • execute_workflow_and_wait                                     │
│  • diagnose_execution, suggest_fix, apply_fix                    │
│  • test_credential, test_webhook_setup                           │
│  • setup_checklist, integration_guide                            │
│  • search_capabilities, list_node_types                          │
│  • Rich rendering tools (draft preview, timeline, checklist)     │
│                                                                  │
│  ❌ EXCLUDED (admin/developer only)                              │
│  ──────────────────────────────────                              │
│  • Raw create_workflow / update_workflow (use drafts instead)    │
│  • delete_workflow (destructive)                                 │
│  • API key management                                            │
│  • Direct credential CRUD                                        │
│  • Audit log access                                              │
│  • Full graph replacement                                        │
│                                                                  │
│  + Runtime guardrail: can be forced read-only via env flag        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

This means a ChatGPT user can **build, test, and run workflows** but cannot accidentally delete workflows or access raw credentials.

---

## Security: Why MCP Doesn't Mean "Give AI Full Control"

Opening your platform to AI clients is a security minefield. Here's how a8n keeps it safe:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 1: Authentication                                             │
│  ───────────────────────                                             │
│  • OAuth 2.1 with PKCE (ChatGPT, Claude Desktop)                    │
│  • API Key with HMAC hashing (programmatic access)                   │
│  • Bearer token middleware                                           │
│                                                                      │
│  Layer 2: Scoped Permissions                                         │
│  ───────────────────────────                                         │
│  • workflows:read, workflows:write, workflows:execute                │
│  • credentials:read, credentials:write                               │
│  • executions:read, system:read, api_keys:manage                     │
│  • Every tool declares its required scope                            │
│  • Scope guard middleware enforces at tool call time                  │
│                                                                      │
│  Layer 3: Approval Guards                                            │
│  ────────────────────────                                            │
│  • Destructive actions require approved: true                        │
│  • High-risk actions require confirmation hash                       │
│  • Hash is computed from action payload (tamper-proof)               │
│  • AI must show preview → get consent → pass hash                   │
│                                                                      │
│  Layer 4: Sensitive Data Rejection                                   │
│  ────────────────────────────────                                    │
│  • Draft answer tool actively refuses secret-looking values          │
│  • Keys: "password", "token", "apiKey", "secret", "rawKey"          │
│  • Forces users to use the credential dashboard                      │
│                                                                      │
│  Layer 5: Rate Limiting                                              │
│  ──────────────────────                                              │
│  • Per-user, per-minute throttling                                   │
│  • Free tier: 30 req/min, Pro tier: 120 req/min                     │
│  • Database-backed in production, in-memory for dev                  │
│                                                                      │
│  Layer 6: Audit Logging                                              │
│  ──────────────────────                                              │
│  • Every tool call logged with user, tool, input, result             │
│  • Approval events separately tracked                                │
│  • Anomaly detection: auth failures, prompt injection, rate bursts   │
│                                                                      │
│  Layer 7: App Profiles                                               │
│  ────────────────────                                                │
│  • Consumer clients (ChatGPT) get curated tool subsets               │
│  • Runtime guardrail: force read-only mode via env flag              │
│  • Semantic classifier detects prompt injection attempts             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Why MCP Is the Perfect Fit for Workflow Tools

Here's the fundamental insight:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Workflow tools have TWO user segments:                          │
│                                                                  │
│  ┌─────────────────┐         ┌─────────────────────────┐        │
│  │  BUILDERS        │         │  USERS                   │        │
│  │  (developers,    │         │  (marketers, founders,   │        │
│  │   power users)   │         │   teachers, ops teams)   │        │
│  │                  │         │                          │        │
│  │  Want: control,  │         │  Want: results,          │        │
│  │  flexibility,    │         │  no learning curve,      │        │
│  │  raw access      │         │  no configuration        │        │
│  │                  │         │                          │        │
│  │  Interface:      │         │  Interface:              │        │
│  │  Canvas + UI     │         │  Natural language        │        │
│  │                  │         │  via AI chat             │        │
│  └─────────────────┘         └─────────────────────────┘        │
│         │                               │                        │
│         │  tRPC                          │  MCP                   │
│         │                               │                        │
│         └───────────────┬───────────────┘                        │
│                         ▼                                        │
│              ┌───────────────────┐                                │
│              │  Same Engine      │                                │
│              │  Same Database    │                                │
│              │  Same Workflows   │                                │
│              └───────────────────┘                                │
│                                                                  │
│  MCP doesn't replace the canvas.                                 │
│  It unlocks the 80% of users who can't use the canvas.          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow tools are uniquely suited for MCP because:**

1. **The operations are structured.** Create nodes, connect edges, set fields, run workflows — these map perfectly to tool schemas.

2. **The domain has clear safety boundaries.** Read-only tools, write tools, destructive tools — easy to classify and gate.

3. **Configuration is the bottleneck, not capability.** Users know *what* they want. They just can't express it in node configs, Handlebars templates, and webhook URLs. AI can translate intent to configuration.

4. **The workflow graph is inspectable.** Unlike code, a workflow graph can be explained, validated, diffed, and previewed in human-readable language before applying.

5. **Errors are diagnosable.** Execution failures have structured data: which node failed, what error, what the input was. Perfect for AI-assisted debugging.

---

## Key Takeaways

1. **The configuration wall kills more users than bad UX.** Most people abandon workflow tools not because the canvas is hard, but because configuring nodes requires technical knowledge they don't have.

2. **MCP turns "configure manually" into "describe in English."** The AI handles node selection, field population, template writing, credential checking, and webhook setup.

3. **Safety gates > blind trust.** The draft-validate-explain-preview-approve lifecycle ensures AI can't accidentally break production workflows. Every destructive action needs explicit human consent + a tamper-proof confirmation hash.

4. **App profiles let you serve multiple audiences.** A developer using Claude Desktop gets 53 tools. A consumer using ChatGPT gets a curated 25. Same platform, different experience.

5. **MCP and the canvas are complementary, not competing.** Technical users still use the canvas for fine-tuning. Non-technical users use AI chat for everything. Both interfaces share the same engine and data.

6. **This is the future of SaaS.** Every tool with a complex configuration surface will eventually need an MCP interface. The question isn't "should we build one?" — it's "how fast can we ship it?"

---

The canvas is for builders.
MCP is for everyone else.

And in a world where 80% of your potential users are "everyone else," MCP isn't a nice-to-have.

**It's the real product.**

---

*This is Part 3 of my a8n deep-dive series.*
*Part 1: "Building a workflow tool is harder than drawing nodes on a canvas."*
*Part 2: "How I Built a Durable Workflow Execution Engine with Inngest."*
*Next: How a8n handles encrypted credential management and multi-provider OAuth.*

*#MCP #ModelContextProtocol #AI #workflows #ChatGPT #buildinpublic #systemdesign #nextjs #typescript*
