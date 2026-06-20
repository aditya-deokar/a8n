# All-Nodes Demo Workflow

## Workflow

**Name:** All Nodes Demo - AI Operations Command Center  
**Owner:** `adityadeokar80@gmail.com`  
**Seed command:** `pnpm seed:showcase`

This is the broad showcase workflow for the platform. It is designed to prove that a8n can accept external events, normalize data, call AI providers, and deliver team alerts through messaging integrations.

## Demo Story

An operations team can receive three kinds of work:

- a manual demo run from the workflow editor
- a Google Form support request
- a Stripe payment event

The workflow normalizes whichever event arrives, sends the normalized event through OpenAI, Anthropic, and Gemini, then posts the final operational alert to Discord and Slack.

## Seeded Graph

```text
Manual Trigger -------\
Google Form Trigger ----> HTTP Request -> OpenAI -> Anthropic -> Gemini -> Discord -> Slack
Stripe Trigger -------/
```

The three trigger nodes all connect into the same HTTP Request node. The execution engine runs them in topological order and passes one accumulated context object through the chain.

## Node-by-Node Purpose

| Node | Purpose | Output variable |
|---|---|---|
| Manual Trigger | Reliable live-demo fallback from the editor | pass-through |
| Google Form Trigger | Realistic support intake through webhook | `googleForm` from webhook |
| Stripe Trigger | Payment or billing event intake through webhook | `stripe` from webhook |
| HTTP Request | Calls `/api/demo/enrichment` to normalize event data | `enrichment` |
| OpenAI | Produces operational triage | `openAiTriage` |
| Anthropic | Drafts customer/team response | `anthropicDraft` |
| Gemini | Creates final executive summary | `geminiSummary` |
| Discord | Posts support alert | `discordAlert` |
| Slack | Posts operations alert | `slackAlert` |

## Demo Enrichment Endpoint

The seeded HTTP node calls:

```text
POST /api/demo/enrichment
```

This endpoint does not call external services. It deterministically normalizes one of:

- `googleForm` context from `/api/webhooks/google-form`
- `stripe` context from `/api/webhooks/stripe`
- fallback manual demo data when the workflow is run from the editor

The normalized event is available at:

```text
{{enrichment.httpResponse.data.demoEvent}}
```

## Credentials To Replace

The seed script creates placeholder credential records if missing. Replace their values in the Credentials screen before a successful live run:

| Placeholder credential | Replace with |
|---|---|
| `Demo OpenAI Credential - replace` | Real OpenAI API key |
| `Demo Anthropic Credential - replace` | Real Anthropic API key |
| `Demo Gemini Credential - replace` | Real Google Gemini API key |

The seed script does not overwrite existing placeholder credential values on reseed. If you replace a placeholder value once, it stays intact.

## Webhook URLs To Replace

Replace these node-level placeholder URLs before a successful live run:

| Node | Placeholder | Replace with |
|---|---|---|
| Discord Support Alert | `https://example.com/replace-discord-webhook` | Discord channel webhook URL |
| Slack Operations Alert | `https://example.com/replace-slack-content-webhook` | Slack workflow/webhook URL that accepts a `content` JSON field |

The reseed script preserves non-placeholder Discord and Slack webhook URLs.

## Local ngrok Setup

Use ngrok when Google Forms or Stripe need to call your local app:

```bash
pnpm dev
pnpm inngest:dev
pnpm seed:showcase
pnpm demo:ngrok
```

`pnpm demo:ngrok` starts a tunnel for `http://localhost:3000`, updates local webhook `.env` values, and prints:

```text
https://<ngrok-url>/api/webhooks/google-form?workflowId=<workflow-id>
https://<ngrok-url>/api/webhooks/stripe?workflowId=<workflow-id>
```

If `pnpm dev` was already running before `.env` changed, restart it so `NEXT_PUBLIC_WEBHOOK_BASE_URL` is reflected in trigger dialogs. Keep `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` on `http://localhost:3000` for normal local login.

## Google Form Test Payload

Use the Google Form trigger dialog to copy the Apps Script, or send a test request:

```bash
curl -X POST "https://<ngrok-url>/api/webhooks/google-form?workflowId=<workflow-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "formId": "demo-form",
    "formTitle": "Support Intake",
    "responseId": "demo-response-1",
    "timestamp": "2026-06-20T10:00:00.000Z",
    "respondentEmail": "rahul@example.com",
    "responses": {
      "Full Name": "Rahul Sharma",
      "Issue Title": "Cannot submit assignment",
      "Issue Description": "The portal shows an error before the deadline.",
      "Urgency": "High"
    }
  }'
```

## Stripe Test Payload

The current Stripe webhook route is demo-only and does not verify Stripe signatures. Use it only for local showcase/testing unless signature verification is added.

```bash
curl -X POST "https://<ngrok-url>/api/webhooks/stripe?workflowId=<workflow-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_demo_123",
    "type": "payment_intent.succeeded",
    "created": 1781930400,
    "livemode": false,
    "data": {
      "object": {
        "amount": 49900,
        "currency": "inr",
        "receipt_email": "customer@example.com"
      }
    }
  }'
```

## Presentation Script

"This workflow is the broadest platform showcase. It begins from three possible entry points: a manual trigger for reliable live demos, a Google Form trigger for support intake, and a Stripe trigger for payment events.

All three paths feed into one normalization step. That HTTP node calls a local demo API that converts the incoming payload into a consistent operational event. From there, the workflow demonstrates AI provider orchestration: OpenAI performs triage, Anthropic drafts a response, and Gemini creates the final executive summary.

Finally, the workflow sends the result to Discord and Slack. That shows the full value of the platform: event intake, data normalization, AI reasoning, cross-node context passing, external notifications, execution history, and real-time node status."

## Live Demo Order

1. Open the workflow graph and explain the three trigger paths.
2. Open the HTTP node and show that it normalizes all event types into one shape.
3. Open the AI nodes and show prompt chaining through `{{variables}}`.
4. Open Discord and Slack nodes and explain the final delivery step.
5. Run manually first for reliability.
6. If ngrok is running, submit the Google Form or Stripe test payload.

## Success Criteria

- The workflow appears under `adityadeokar80@gmail.com`.
- The graph contains 9 nodes and 8 connections.
- The HTTP enrichment endpoint works without third-party credentials.
- With real AI keys and messaging webhooks in place, execution reaches `SUCCESS`.
- Execution output contains `enrichment`, `openAiTriage`, `anthropicDraft`, `geminiSummary`, `discordAlert`, and `slackAlert`.
