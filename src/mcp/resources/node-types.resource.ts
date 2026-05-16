/**
 * Resource: n8n://schema/node-types
 *
 * Provides LLMs with a comprehensive reference of all available
 * node types, their categories, descriptions, and configuration fields.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const NODE_TYPES_DOC = `# n8n Node Types Reference

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
| HTTP_REQUEST | Make HTTP requests to external APIs              | url, method, headers, body               |
| DISCORD      | Send messages to Discord channels via webhooks   | webhookUrl, content                      |
| SLACK        | Send messages to Slack channels via webhooks     | webhookUrl, text, channel                |

### AI Nodes

| Type      | Description                              | Data Fields                         | Required Credential |
|-----------|------------------------------------------|-------------------------------------|---------------------|
| OPENAI    | Generate text using OpenAI GPT models    | model, prompt, temperature          | OPENAI              |
| ANTHROPIC | Generate text using Anthropic Claude     | model, prompt, maxTokens            | ANTHROPIC           |
| GEMINI    | Generate text using Google Gemini        | model, prompt                       | GEMINI              |

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
    "n8n://schema/node-types",
    { description: "All available node types with categories, descriptions, data fields, and credential requirements." },
    async () => ({
      contents: [
        {
          uri: "n8n://schema/node-types",
          mimeType: "text/markdown",
          text: NODE_TYPES_DOC,
        },
      ],
    }),
  );
}
