# Showcase Workflow

## Recommended showcase workflow

The best workflow to showcase this project is:

**AI-Powered Customer Support Triage**

## Why this is the best showcase

This workflow is strong because it demonstrates a real business problem and uses the product in a natural way:

- it captures incoming requests automatically
- it uses AI for actual decision support, not just a gimmick
- it alerts a team immediately
- it shows graph-based automation clearly
- it is easy for a reviewer to understand in one minute

It also highlights the platform's strongest parts:

- trigger node
- AI executor node
- notification node
- context passing between nodes
- durable execution history

## Real problem it solves

Small teams often receive support or issue reports through forms, but triaging them manually takes time.

Typical pain points:

- the team reads every submission manually
- urgent issues are mixed with low-priority ones
- the summary is inconsistent
- routing the issue to the right team is slow

This workflow solves that by:

1. accepting a new support submission
2. sending the submission to an AI node
3. generating a structured triage summary
4. notifying the support team instantly

## Final workflow design

### Main version

`Google Form Trigger -> OpenAI -> Discord`

### Fallback demo version

`Manual Trigger -> OpenAI -> Discord`

The main version is better for "real-world value."
The fallback version is better for "safe live demo."

## Business scenario

Imagine a college project team, startup, or campus helpdesk that receives support requests through a Google Form.

A user submits:

- name
- email
- issue title
- issue description
- urgency

The workflow then:

- collects the form submission
- asks OpenAI to classify the issue
- generates a short support summary
- recommends the next action
- posts the result to a Discord support channel

## What the reviewer will understand immediately

When you show this workflow, the reviewer will quickly understand:

- this is not a toy graph
- the automation has a business purpose
- AI is used for triage and summarization
- the system can integrate with external events and team communication

## Node-by-node build guide

## 1. Trigger node

### Preferred: Google Form Trigger

Use this when you want to show a realistic inbound process.

Form fields to create:

- `Full Name`
- `Email`
- `Issue Title`
- `Issue Description`
- `Urgency`

Example test submission:

- Full Name: `Rahul Sharma`
- Email: `rahul@example.com`
- Issue Title: `Cannot submit assignment`
- Issue Description: `The portal shows an error when I try to submit my assignment before the deadline.`
- Urgency: `High`

Important variables available in the workflow:

- `{{googleForm.respondentEmail}}`
- `{{googleForm.responses['Full Name']}}`
- `{{googleForm.responses['Issue Title']}}`
- `{{googleForm.responses['Issue Description']}}`
- `{{googleForm.responses['Urgency']}}`
- `{{json googleForm.responses}}`

### Fallback: Manual Trigger

Use this if you want a safer demo without depending on an external form submission during the review.

In that case, you can explain:

"For live demonstration, I can trigger the same analysis workflow manually. In production, the same logic would normally start from Google Form or another external event."

## 2. OpenAI node

### Goal

This node should turn raw form data into a decision-ready support summary.

### Suggested variable name

`supportTriage`

### Suggested system prompt

```text
You are a senior customer support triage assistant.

Your job is to analyze incoming support issues and produce a concise operational summary.

Always return:
1. Category
2. Priority
3. One-line summary
4. Recommended next action
5. Whether this should be escalated immediately

Keep the answer short, structured, and easy for an operations team to act on.
```

### Suggested user prompt for Google Form version

```text
Analyze this support request.

Customer name: {{googleForm.responses['Full Name']}}
Customer email: {{googleForm.respondentEmail}}
Issue title: {{googleForm.responses['Issue Title']}}
Issue description: {{googleForm.responses['Issue Description']}}
Urgency selected by user: {{googleForm.responses['Urgency']}}

Return:
- Category
- Priority
- One-line summary
- Recommended next action
- Escalate: Yes or No
```

### Suggested user prompt for Manual Trigger version

If you want to demo without Google Form data, paste a prompt like this:

```text
Analyze this support issue:

Customer name: Demo User
Customer email: demo@example.com
Issue title: Payment confirmation not received
Issue description: The user completed a payment but still has not received confirmation after 20 minutes.
Urgency selected by user: High

Return:
- Category
- Priority
- One-line summary
- Recommended next action
- Escalate: Yes or No
```

## 3. Discord node

### Why Discord instead of Slack for the demo

The Discord webhook path is the safer live-demo option in the current project because the Discord executor aligns directly with Discord webhook payload structure.

### Suggested variable name

`supportAlert`

### Suggested bot username

`Nodebase Support Bot`

### Suggested message content

For Google Form version:

```text
New support request received

Customer: {{googleForm.responses['Full Name']}}
Email: {{googleForm.respondentEmail}}
Title: {{googleForm.responses['Issue Title']}}
User urgency: {{googleForm.responses['Urgency']}}

AI Triage:
{{supportTriage.text}}
```

For Manual Trigger version:

```text
Demo support triage result

{{supportTriage.text}}
```

## Visual graph layout

Use a simple left-to-right layout:

1. Trigger node on the left
2. OpenAI node in the middle
3. Discord node on the right

That makes the automation easy to explain visually:

- input
- analysis
- action

## What to say while building it live

### While adding the trigger

"I start with a Google Form trigger because in real organizations, support and issue intake often begins from a structured form."

### While adding the OpenAI node

"This node is where the raw submission becomes operationally useful. Instead of just forwarding text, the platform classifies the issue and generates a short triage summary."

### While adding the Discord node

"Now I send the AI-triaged result directly to the support channel, so the team sees a structured alert instead of a raw message."

## Expected output example

If the issue is "cannot submit assignment before deadline," the OpenAI result may look like:

```text
Category: Submission failure
Priority: High
One-line summary: Student cannot submit an assignment due to portal error before the deadline.
Recommended next action: Verify submission service status and manually extend or assist submission if outage is confirmed.
Escalate: Yes
```

The Discord alert then becomes immediately useful to a support or operations team.

## Why this workflow feels senior

This workflow feels senior because it is not "AI for decoration." It uses AI where it adds operational leverage:

- classification
- summarization
- prioritization
- action recommendation

That is the right way to position AI in a system design review.

## If the reviewer asks "Why not just send the form directly to Discord?"

Answer:

"That would only automate delivery, not decision support. The OpenAI node adds the actual value by converting raw issue text into a structured triage output that helps a team act faster."

## If the reviewer asks "How is this better than a normal notification bot?"

Answer:

"A normal notification bot forwards messages. This workflow transforms information first, then routes it. That means the system is not just passing data; it is improving the quality of the data before it reaches the team."

## Optional extension if you want a bigger demo

After the Discord node, you can later add:

- `HTTP Request` to send triage data to an external logging endpoint
- `Slack` once that node is aligned for the target webhook format
- `Stripe Trigger` for payment-event workflows

But for the cleanest current showcase, stick to:

`Google Form Trigger -> OpenAI -> Discord`
