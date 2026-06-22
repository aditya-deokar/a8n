/**
 * Resource: a8n://schema/node-types
 *
 * Provides LLMs with a comprehensive reference of all available
 * node types, their categories, descriptions, and configuration fields.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const NODE_TYPES_DOC = `# a8n Node Types Reference

Nodes are the building blocks of workflows. Each node has a **type**, a **category**, and specific **data fields**.

## Categories

| Category | Description                                          |
|----------|------------------------------------------------------|
| trigger  | Entry points that start a workflow execution          |
| action   | Perform operations (HTTP calls, send messages, etc.)  |
| ai       | LLM-powered text generation nodes                     |
| system   | Internal nodes (e.g., INITIAL placeholder)            |

## Available Node Types

### Triggers

| Type                | Description                                           | Data Fields                      |
|---------------------|-------------------------------------------------------|----------------------------------|
| MANUAL_TRIGGER      | Manually triggered entry point                        | (none)                           |
| GOOGLE_FORM_TRIGGER | Triggered by Google Form submissions                  | formId                           |
| STRIPE_TRIGGER      | Triggered by Stripe webhook events                    | eventType                        |

### Actions

| Type         | Description                                      | Data Fields                              |
|--------------|--------------------------------------------------|------------------------------------------|
| HTTP_REQUEST | Make HTTP requests to external APIs              | variableName, endpoint, method, body     |
| DISCORD      | Send messages to Discord channels via webhooks   | variableName, webhookUrl, content, username |
| SLACK        | Send messages to Slack/workflow webhooks         | variableName, webhookUrl, content        |
| EMAIL        | Send email through SMTP                          | variableName, credentialId, to, subject, body, from, replyTo |
| GOOGLE_SHEETS | Append a row to a Google Sheet                 | variableName, credentialId, spreadsheetId, sheetName, rowJson |

### AI Nodes

| Type      | Description                              | Data Fields                         | Required Credential |
|-----------|------------------------------------------|-------------------------------------|---------------------|
| OPENAI    | Generate text using OpenAI GPT models    | variableName, credentialId, systemPrompt, userPrompt | OPENAI              |
| ANTHROPIC | Generate text using Anthropic Claude     | variableName, credentialId, systemPrompt, userPrompt | ANTHROPIC           |
| GEMINI    | Generate text using Google Gemini        | variableName, credentialId, systemPrompt, userPrompt | GEMINI              |

### Action Credentials

| Type          | Required Credential | Credential Value Format       |
|---------------|---------------------|-------------------------------|
| EMAIL         | SMTP_EMAIL          | SMTP JSON with host, port, user, pass |
| GOOGLE_SHEETS | GOOGLE_SHEETS       | Google service-account JSON   |

### System

| Type    | Description                                    | Data Fields |
|---------|------------------------------------------------|-------------|
| INITIAL | Placeholder start node (auto-created)          | (none)      |

## Connecting Nodes

- Every node has a default **"main"** input and output handle
- Connect nodes by creating edges from a source node's output to a target node's input
- Trigger nodes have no input — they are always the first node in a chain
- AI nodes require a linked **credential** of the matching type
`;

export function registerNodeTypesResource(server: McpServer) {
  server.resource(
    "node-types",
    "a8n://schema/node-types",
    { description: "All available node types with categories, descriptions, data fields, and credential requirements." },
    async () => ({
      contents: [
        {
          uri: "a8n://schema/node-types",
          mimeType: "text/markdown",
          text: NODE_TYPES_DOC,
        },
      ],
    }),
  );
}
