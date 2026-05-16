# Showcase Workflow Script

This script is specifically for presenting the **AI-Powered Customer Support Triage** workflow.

Use this when you want to show one concrete workflow that proves the product solves a real problem.

## Best presentation style

This workflow is best presented in four stages:

1. explain the business problem
2. show the workflow graph
3. run the workflow or explain the trigger
4. show the outcome and connect it to product value

## Short 2-minute script

"To showcase the practical value of this platform, I created a workflow called AI-Powered Customer Support Triage.

The problem it solves is simple but real: support teams often receive issue reports through forms, but reading and prioritizing each submission manually is slow and inconsistent.

In this workflow, a Google Form submission triggers the process. The form data is passed into an OpenAI node, which classifies the issue, assigns a priority, summarizes it in one line, and recommends the next action. Then the result is sent to a Discord support channel so the team receives a structured alert immediately.

So instead of just forwarding raw data, the workflow transforms the input into something actionable. This shows the value of the platform very clearly: it can take an external event, apply AI-based decision support, and automate the team response."

## Full 5-minute script

"To demonstrate the project in a more practical way, I created a workflow called AI-Powered Customer Support Triage.

This workflow solves a very common operational problem. Many teams collect support issues through forms, but the data arrives as raw text. Someone still has to read it, understand the problem, decide how urgent it is, and then notify the right people. That process is manual and slow.

So I built a workflow that automates that first layer of triage.

The workflow starts with a Google Form trigger. This represents a real incoming support request from a user. The form can include fields like name, email, issue title, issue description, and urgency.

That data is then passed to an OpenAI node. This is where the platform does something more valuable than a simple notification tool. The AI node analyzes the submission and returns a structured support summary with category, priority, one-line summary, recommended next action, and whether the issue should be escalated.

Finally, the result is sent to Discord through a webhook node, so the support team gets an immediate, readable alert.

So the workflow is not just:
receive message and forward message.

It is:
receive request, understand request, improve the data quality, and then deliver an actionable result.

That is why I think this is the best showcase workflow for the project. It demonstrates event-driven automation, AI integration, variable passing between nodes, execution history, and real operational value, all in a very compact graph."

## Live demo script

## Step 1: show the graph

"This is the workflow graph. It has three core stages:

1. intake through Google Form
2. AI-based triage through OpenAI
3. alert delivery through Discord"

## Step 2: explain the trigger

"Here the workflow begins when a support form is submitted. This is a strong demo trigger because it represents a realistic external business event, not just a button click."

## Step 3: explain the AI node

"This OpenAI node is the most important part of the workflow. I use it to convert raw issue text into a structured triage summary. This is where the workflow becomes useful, because teams do not just need information delivered; they need it interpreted."

## Step 4: explain the notification node

"Once the issue is summarized and prioritized, it is posted to Discord. That means the team receives a clear operational message immediately."

## Step 5: explain the result

"The final output is a support-ready alert that is much easier to act on than the original raw submission."

## If you are using Google Form in the live demo

Say this before triggering:

"I will now submit a sample support request through the form, and that will trigger the workflow automatically."

Say this after submission:

"Now the workflow receives the payload, passes it through the AI node, and then sends the final triage result to the team channel."

## If you are using Manual Trigger in the live demo

Say this instead:

"For presentation reliability, I am triggering the same logic manually here. In the real use case, the exact same workflow would normally start from a Google Form submission."

That line is useful because it shows practical maturity, not weakness.

## Sample reviewer narration for a test case

"For example, suppose a student submits an issue saying they cannot upload their assignment before the deadline because the portal is failing.

Without automation, a support team member has to read the whole message, identify that it is high priority, and decide whether it needs immediate escalation.

In this workflow, the AI node performs that first-pass reasoning automatically and sends the result in a structured form to the team."

## Best explanation of why this is valuable

"The real value here is not just automation of movement. It is automation of understanding. The workflow does not simply move data from one place to another. It improves the quality of the data before passing it forward."

## Architecture tie-in script

If the reviewer asks how this connects to the system architecture, say:

"This one workflow also represents the larger architecture of the project. The workflow is created through the web app, stored in the database as nodes and connections, executed durably through the Inngest-based engine, and can also be managed through the MCP layer for AI clients. So even this small demo reflects the broader system design."

## Strong closing for this workflow

"I chose this workflow because it is simple enough to demo quickly, but rich enough to show the real strengths of the platform: automation, AI reasoning, external integration, and execution visibility."

## Backup workflow if Discord is unavailable

If Discord webhook setup is not ready, keep the same workflow concept and say:

"Even if I stop at the OpenAI node, the core value is still visible because the system already transformed the raw support request into structured triage output. The notification node is just the final delivery step."

## Final one-line pitch

"This workflow shows that the platform does not just automate tasks; it automates the first layer of operational decision-making."
