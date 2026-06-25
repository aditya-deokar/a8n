# a8n ChatGPT App Submission Copy

Use this copy as the baseline for the OpenAI Platform Dashboard app submission.

## App Identity

| Field | Value |
|---|---|
| App name | a8n |
| Category | Productivity |
| Primary language | English (en-US) |
| Icon path | `/a8n-app-logo.svg` |
| MCP server URL | `https://<production-domain>/api/mcp?profile=chatgpt` |
| Privacy URL | `https://<production-domain>/privacy` |
| Support URL | `https://<production-domain>/support` |

## Short Description

Create, inspect, test, and debug a8n workflow automations directly from ChatGPT.

## Long Description

a8n is a workflow automation platform for building drag-and-drop automations with AI, webhooks, APIs, messaging, email, and spreadsheets. The ChatGPT app lets connected users list workflows, explain automations, create and preview workflow drafts, review setup checklists, run approved tests, inspect execution timelines, and diagnose failed runs without exposing raw credential secrets.

## OAuth

| Field | Value |
|---|---|
| Protected resource metadata | `https://<production-domain>/.well-known/oauth-protected-resource` |
| Authorization server metadata | `https://<production-domain>/.well-known/oauth-authorization-server` |
| Redirect URI shape | `https://chatgpt.com/connector/oauth/{callback_id}` |
| PKCE method | `S256` |

Scopes:

```txt
workflows:read
workflows:write
credentials:read
executions:read
executions:write
system:read
```

## Reviewer Notes

Use the provided golden prompts to verify read-only discovery, draft creation, approval-gated writes, approved sample execution, timeline rendering, and failure diagnosis. Destructive/admin tools are intentionally excluded from the ChatGPT profile.

## Release Notes

Initial a8n ChatGPT app submission with OAuth account linking, curated workflow tools, workflow draft/setup/approval/timeline widgets, prompt-injection safety metadata, and production readiness checks.

## Localization Notes

Initial submission targets English (en-US). Tool and widget copy is written in plain English and can be localized in a future app version.
