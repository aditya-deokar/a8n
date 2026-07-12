# How I Gave 80% of Users Access to a Workflow Automation Platform — Without Teaching Them a Single UI

**Role:** AI Engineer / Forward Deployed Engineer
**Project:** a8n — Open-source workflow automation platform (n8n-inspired)
**Stack:** Next.js, TypeScript, MCP (Model Context Protocol), Inngest, Prisma, React Flow

---

## Quick Facts

| | |
|---|---|
| **Problem** | 80% of potential users couldn't use the workflow platform because configuring nodes required technical knowledge they didn't have |
| **Goal** | Let non-technical users build, test, and run workflows using natural language — without ever touching the canvas |
| **Constraints** | Must use the same backend engine (no separate system), must not compromise security, must work with any MCP-compatible AI client |
| **What Changed** | Added a 53-tool MCP server as a parallel entry point. Users describe goals in English; AI handles all configuration. |
| **Biggest Challenge** | Building an AI interface that's powerful enough to replace manual configuration but safe enough to prevent unauthorized mutations |
| **What I Learned** | The bottleneck in SaaS adoption isn't UI complexity — it's the assumption that users know the domain's vocabulary |

---

## The Hero

This case study isn't about me. It's about the person I was building for.

A marketing manager. A teacher. A startup founder who wants to automate their Google Form responses. A small business owner who wants Slack alerts when someone pays on Stripe.

They know **what** they want. They just can't express it in node configurations, Handlebars templates, and webhook URLs.

These aren't edge cases. They're **80% of the potential user base** for any workflow tool.

---

## The Problem

I built a8n — a workflow automation platform with a drag-and-drop canvas, a visual node editor, and a durable execution engine.

It worked. Technically, it was solid.

Then I watched someone try to use it.

They wanted something simple: *"When someone submits my feedback form, summarize the response with AI and email them back."*

Here's what the platform required them to do:

```
┌──────────────────────────────────────────────────────────────────┐
│               WHAT THE USER HAD TO DO                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1.  Know this requires 3 separate nodes                        │
│   2.  Find the Google Form Trigger in the node menu              │
│   3.  Understand what a "webhook URL" is                         │
│   4.  Copy the webhook URL to Google Apps Script                 │
│   5.  Write a Google Apps Script trigger function                │
│   6.  Find the Gemini AI node                                    │
│   7.  Navigate to console.cloud.google.com for an API key        │
│   8.  Create a credential entry in the vault                     │
│   9.  Link the credential to the Gemini node                     │
│   10. Write a Handlebars prompt:                                 │
│       "Summarize: {{json googleForm.responses}}"                 │
│   11. Configure the Email node with SMTP host, port, auth        │
│   12. Set the recipient: {{googleForm.respondentEmail}}          │
│   13. Set the body: {{geminiResult.text}}                        │
│   14. Connect all 3 nodes with edges on the canvas               │
│   15. Save the workflow                                          │
│   16. Run it                                                     │
│   17. Debug when it fails the first time                         │
│                                                                  │
│   Steps requiring technical knowledge: 15 out of 17              │
│   Steps a non-technical user can do: 2 (steps 1 and 16)         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

They gave up in 3 minutes. Not because the UI was ugly. Not because the platform was slow. Because **configuring the nodes required a vocabulary they didn't have.**

What's a Handlebars template? What's an SMTP port? What's `{{json googleForm.responses}}`?

The platform was functional. It just wasn't accessible.

---

## The Stakes

This isn't a minor inconvenience. It's a fundamental business problem:

- **Every user who bounces at the configuration screen = wasted acquisition cost**
- **The addressable market shrinks to ~20% (developers and power users only)**
- **Support tickets spike** because users get stuck mid-configuration
- **Competitors with simpler (but less powerful) tools win** because "easy" beats "capable"

The irony: the execution engine I'd built was production-grade — topological sorting, durable execution with Inngest, per-step retries, real-time status updates. But the users who would benefit most from this power couldn't access it.

**The capability existed. The interface to that capability was the bottleneck.**

---

## My Role (The Guide)

I wore three hats:

1. **Product thinker** — Identify why users were failing and reframe the problem
2. **System designer** — Architect a solution that doesn't require building a second backend
3. **AI engineer** — Build the MCP interface layer that translates natural language into platform operations

My job wasn't to simplify the UI. That approach has diminishing returns — you can only remove so many form fields before you lose functionality. My job was to find an entirely different path to the same destination.

---

## The Journey

### Phase 1: Understanding the Real Bottleneck

The first instinct was to improve the UI. Better tooltips. Fewer form fields. Guided wizards.

But I realized the problem wasn't UI design. It was **conceptual.**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   The user's mental model:                                       │
│   "Send AI summary of form responses to the person who filled   │
│    out the form"                                                  │
│                                                                  │
│   The platform's mental model:                                   │
│   "Create GOOGLE_FORM_TRIGGER node, link GEMINI credential,     │
│    write Handlebars template referencing googleForm.responses,   │
│    add EMAIL node with SMTP config, use template variable        │
│    {{geminiResult.text}} in body..."                             │
│                                                                  │
│   The gap between these two? That's the configuration wall.      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

No amount of UI polish closes this gap. The user thinks in **goals**. The platform thinks in **configurations**. Someone — or something — needs to translate.

### Phase 2: The Insight — AI as the Translator

The turning point wasn't a technology decision. It was a framing shift.

Instead of asking *"How do I make the configuration UI easier?"* I asked:

> **"What if the user never sees the configuration UI at all?"**

What if they could describe their goal in one sentence, and an AI agent handles the entire configuration — node selection, field population, template writing, credential linking, webhook setup — on their behalf?

The user isn't lazy or incapable. They're **highly competent at expressing intent.** They just don't speak the platform's language. AI does.

### Phase 3: Why MCP (Not a Custom Chatbot)

My first thought was to build a chatbot UI inside the dashboard. But that approach has problems:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   CUSTOM CHATBOT                    MCP SERVER                   │
│   ──────────────                    ──────────                   │
│                                                                  │
│   Works with: only my UI            Works with: any MCP client   │
│   Maintenance: I maintain the       Maintenance: I maintain one  │
│     AI integration logic              server. Clients evolve     │
│   Reach: only my users               independently.              │
│   Lock-in: users must use my        Reach: ChatGPT, Claude,      │
│     dashboard                         Cursor, and any future     │
│   AI model: I pick one               MCP client                  │
│                                     AI model: user's choice      │
│                                                                  │
│   MCP gives me N clients for the price of 1 server.              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

MCP (Model Context Protocol) is an open standard — originally from Anthropic, now under the Linux Foundation — that provides a universal interface between AI clients and external tools. One server. Every client.

I chose MCP because:
- Build once, connect to ChatGPT, Claude, Cursor, and any future MCP client
- The protocol handles transport, authentication, and tool discovery
- My platform doesn't need to know which AI model the user prefers
- The ecosystem is already at 97M+ monthly SDK downloads

---

## The Turning Point

The key architectural insight was: **the MCP server shouldn't expose raw CRUD operations to AI agents.**

If I just exposed `create_workflow`, `update_workflow`, and `delete_workflow`, the AI could:
- Create malformed workflows that crash on execution
- Overwrite working configurations with hallucinated data
- Skip credential checks and produce unusable nodes
- Perform destructive actions without the user knowing

Instead, I designed a **staged draft lifecycle** — a safe sandbox where the AI can plan, build, and iterate without ever touching production data until the user explicitly approves.

This was the decision that made the entire system viable.

---

## The Solution

### Architecture: Two Entry Points, One Engine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     a8n DUAL ENTRY POINTS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TECHNICAL USERS                      NON-TECHNICAL USERS               │
│  (developers, power users)            (marketers, founders, teachers)   │
│                                                                         │
│  ┌──────────────┐                     ┌──────────────────┐              │
│  │  React Canvas │                     │  Any AI Client    │              │
│  │  (Dashboard)  │                     │  (ChatGPT, Claude,│              │
│  │              │                     │   Cursor, etc.)   │              │
│  └──────┬───────┘                     └────────┬─────────┘              │
│         │                                      │                        │
│         │  tRPC mutations                      │  MCP Protocol          │
│         │                                      │                        │
│         └──────────────┬───────────────────────┘                        │
│                        ▼                                                │
│             ┌───────────────────────┐                                   │
│             │    Shared Core        │                                   │
│             │    • Prisma DB        │                                   │
│             │    • Inngest Engine   │                                   │
│             │    • Credential Vault │                                   │
│             │    • Executor Registry│                                   │
│             └───────────────────────┘                                   │
│                                                                         │
│  A workflow built via MCP shows up on the canvas.                       │
│  A workflow built on the canvas is accessible via MCP.                  │
│  Same engine. Same data. Different audience.                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

No second backend. No data sync issues. No feature parity gaps. The MCP server calls the same Prisma database, triggers the same Inngest execution engine, and uses the same credential vault as the dashboard.

### The MCP Server: 53 Tools Across 7 Domains

The server isn't a thin wrapper. It's a full-featured interface organized into tool domains:

```
┌──────────────────────────────────────────────────────────────────┐
│  📋 Workflows   (23)  │  Plan, draft, validate, explain,        │
│                        │  preview, apply, execute, version        │
├────────────────────────┼─────────────────────────────────────────┤
│  🔐 Credentials (6)   │  List, create, update, delete, by-type  │
├────────────────────────┼─────────────────────────────────────────┤
│  ▶️  Executions  (8)   │  Run, wait, test, timeline, diagnose,   │
│                        │  suggest fix, apply fix                  │
├────────────────────────┼─────────────────────────────────────────┤
│  🧩 Nodes       (2)   │  List types, search capabilities         │
├────────────────────────┼─────────────────────────────────────────┤
│  🔧 System      (5)   │  Identity, health, security, audit       │
├────────────────────────┼─────────────────────────────────────────┤
│  🔑 API Keys    (3)   │  Create, list, revoke                    │
├────────────────────────┼─────────────────────────────────────────┤
│  🔗 Integrations(6)   │  Setup checklists, guides, webhook URLs, │
│                        │  credential tests, Apps Script generator │
└────────────────────────┴─────────────────────────────────────────┘
```

Plus **6 resources** (node catalog, credential types, workflow schemas, API docs) and **3 guided prompts** (create workflow, setup integration, debug execution) that teach the AI *how* to use the tools in the right sequence.

### The Draft Lifecycle: How AI Builds Workflows Safely

This is the core product flow. When a user describes a goal in English, here's the pipeline the AI follows:

```
┌──────────────────────────────────────────────────────────────────────┐
│           NATURAL LANGUAGE → RUNNING WORKFLOW                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User: "Auto-respond to my feedback form with a Gemini summary"     │
│                                                                      │
│  ┌──────────────────────────────────────┐                            │
│  │ 1. plan_workflow_from_goal           │                            │
│  │    Parses intent → maps to nodes:    │  Read-only.                │
│  │    GOOGLE_FORM_TRIGGER → GEMINI →    │  No side effects.          │
│  │    EMAIL                             │  Zero risk.                │
│  │    Estimates effort: medium          │                            │
│  │    Flags risks: "sends real email"   │                            │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 2. create_workflow_draft             │                            │
│  │    Builds a DRAFT (sandbox):         │  Saved to DB, but          │
│  │    • 3 nodes auto-positioned         │  NOT applied to any        │
│  │    • Edges connecting them           │  live workflow.             │
│  │    • Handlebars templates pre-filled │  Fully reversible.         │
│  │    • Missing fields identified       │                            │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 3. answer_workflow_draft_questions   │                            │
│  │    AI fills non-sensitive fields:    │  ⛔ Automatically REJECTS  │
│  │    • Email subject line              │  passwords, API keys,      │
│  │    • Prompt wording                  │  tokens, secrets.          │
│  │    • Variable names                  │  Directs to credential     │
│  │                                      │  dashboard.                │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 4. validate_workflow_draft           │                            │
│  │    Automated checks:                 │  Catches errors before     │
│  │    • Missing required fields         │  they reach production.    │
│  │    • Graph cycles                    │                            │
│  │    • Credential compatibility        │                            │
│  │    • Unreachable nodes               │                            │
│  │    • Duplicate variable names        │                            │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 5. explain_workflow                  │                            │
│  │    Returns plain English:            │  User sees:                │
│  │    "When someone submits your form,  │  "This will email          │
│  │    this workflow will:               │   real people."            │
│  │    1. Receive the form data          │                            │
│  │    2. Summarize it with Gemini AI    │  User can say: "Change     │
│  │    3. Email the summary to the       │  the email subject" or     │
│  │       respondent."                   │  "Use OpenAI instead"      │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 6. preview_workflow_diff             │                            │
│  │    Shows exactly what will change:   │  Generates a tamper-proof  │
│  │    • Added nodes                     │  confirmation hash.        │
│  │    • Changed fields                  │  AI cannot skip this step. │
│  │    • Side effects                    │                            │
│  │    • Rollback plan                   │                            │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 7. User says "Yes, looks good" ✓     │  AI calls                  │
│  │    apply_workflow_draft(             │  apply_workflow_draft      │
│  │      approved: true,                 │  with the hash.            │
│  │      confirmationHash: "a3f2c1...")  │  Atomically creates        │
│  │                                      │  the live workflow.        │
│  └───────────────┬──────────────────────┘                            │
│                  ▼                                                    │
│  ┌──────────────────────────────────────┐                            │
│  │ 8. execute_workflow_and_wait         │                            │
│  │    Triggers via Inngest engine →     │  Same durable execution    │
│  │    Returns results in chat           │  as the canvas.            │
│  └──────────────────────────────────────┘                            │
│                                                                      │
│  Total technical knowledge required from user: ZERO                  │
│  Total time: ~2 minutes                                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The user never saw a Handlebars template. Never typed a webhook URL. Never configured SMTP. The AI did all of that — and the user approved the result in plain English.

### What the AI Actually Generates (Concrete Example)

When the user says *"auto-respond to form with Gemini summary,"* the `plan_workflow_from_goal` tool parses the intent and maps it to platform primitives:

```
┌──────────────────────────────────────────────────────────────────┐
│  Goal: "Auto-respond to feedback form with Gemini summary"      │
│                                                                  │
│  Parsed plan:                                                    │
│  ├── Node 1: GOOGLE_FORM_TRIGGER (receives form submissions)    │
│  ├── Node 2: GEMINI (summarizes with pre-filled prompt:         │
│  │           "Summarize: {{json googleForm.responses}}")         │
│  └── Node 3: EMAIL (sends to: {{googleForm.respondentEmail}},   │
│              body: {{geminiResult.text}})                        │
│                                                                  │
│  Auto-detected:                                                  │
│  • Required apps: Google Forms, Gemini, Email/SMTP               │
│  • Required credentials: Gemini API key, SMTP config             │
│  • Suggested template: "google-form-ai-email"                    │
│  • Risks: "This workflow can send email to real people."         │
│  • Effort: medium                                                │
│                                                                  │
│  Auto-generated Handlebars templates:                            │
│  • Prompt: "Summarize this form response:                        │
│            {{json googleForm.responses}}"                        │
│  • Email to: "{{googleForm.respondentEmail}}"                    │
│  • Email body: "{{geminiResult.text}}"                           │
│                                                                  │
│  The user wrote NONE of these. The AI did.                       │
└──────────────────────────────────────────────────────────────────┘
```

### The ChatGPT App Profile

Not every AI client is the same. A developer using Claude Desktop needs the full 53-tool set. A consumer using ChatGPT needs something curated and safer.

a8n serves both with **app profiles**:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Developer profile: 53 tools                                     │
│  (Claude Desktop, Cursor, custom agents)                         │
│  • Full CRUD, raw graph replacement, API key management          │
│  • Audit logs, security status, version management               │
│                                                                  │
│  ChatGPT consumer profile: 25 curated tools                      │
│  (ChatGPT Apps store)                                            │
│  • Draft-based creation only (no raw mutation)                   │
│  • Cannot delete workflows                                       │
│  • Cannot access raw credentials                                 │
│  • Rich rendering tools for visual feedback                      │
│  • Can be forced read-only via runtime flag                      │
│                                                                  │
│  Same server. Same protocol. Different tool surface.             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## The Results

### Before vs After

```
┌───────────────────┬─────────────────────┬─────────────────────┐
│                   │  BEFORE (Canvas)    │  AFTER (MCP)        │
├───────────────────┼─────────────────────┼─────────────────────┤
│ Steps to create   │  17 manual steps    │  1 English sentence │
│ a workflow        │                     │  + "Yes, apply it"  │
├───────────────────┼─────────────────────┼─────────────────────┤
│ Technical         │  High               │  None               │
│ knowledge needed  │  (APIs, templates,  │  (describe goal in  │
│                   │   webhooks, SMTP)   │   plain language)   │
├───────────────────┼─────────────────────┼─────────────────────┤
│ Time to first     │  30–45 minutes      │  ~2 minutes         │
│ working workflow  │                     │                     │
├───────────────────┼─────────────────────┼─────────────────────┤
│ Addressable       │  ~20%               │  ~100%              │
│ audience          │  (developers only)  │  (anyone with an    │
│                   │                     │   AI client)        │
├───────────────────┼─────────────────────┼─────────────────────┤
│ New infra needed  │  N/A                │  Zero               │
│ for MCP layer     │                     │  (same DB, same     │
│                   │                     │   engine, 1 route)  │
├───────────────────┼─────────────────────┼─────────────────────┤
│ AI clients        │  N/A                │  ChatGPT, Claude,   │
│ supported         │                     │  Cursor, any future │
│                   │                     │  MCP client         │
└───────────────────┴─────────────────────┴─────────────────────┘
```

### What This Unlocked

- **The canvas still exists** — power users still drag, drop, and configure manually
- **MCP is the second door** — non-technical users enter through AI conversation
- **Both doors lead to the same room** — same workflows, same database, same engine
- **New capabilities emerged** — AI-powered debugging (`diagnose_execution`), auto-repair (`apply_workflow_fix`), and capability search (`search_capabilities`) are things the canvas UI never had

---

## Reflection

### What Surprised Me

The biggest insight wasn't about MCP or AI. It was about **product design:**

> The bottleneck in SaaS adoption isn't UI complexity. It's the assumption that users know the domain's vocabulary.

Every workflow tool — n8n, Zapier, Make — assumes users understand "triggers," "nodes," "credentials," and "webhooks." MCP eliminated that assumption entirely. The user speaks in goals. The AI speaks in platform primitives. The gap vanishes.

### What I'd Improve

- **Parallel node execution** — Currently the engine runs nodes sequentially. Nodes with no dependency could run concurrently.
- **Smarter plan_workflow_from_goal** — The current goal parser uses keyword matching. A fine-tuned LLM could handle more nuanced requests.
- **Richer feedback during execution** — The AI could narrate what each node is doing in real time as the workflow runs.

### The Takeaway

If you're building a SaaS platform with a complex configuration surface, consider this: **your competition isn't other platforms with better UIs. It's the question of whether a non-technical user can achieve their goal at all.**

MCP gave a8n the answer: yes — in one sentence.

---

> **Companion case study:** [Designing a 53-Tool MCP Server That AI Can't Abuse →](#)
> *A deep-dive into the safety architecture: how approval gates, scoped permissions, and sensitive data rejection keep the system trustworthy.*
