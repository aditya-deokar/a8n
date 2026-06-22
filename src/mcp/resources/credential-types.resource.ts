/**
 * Resource: a8n://schema/credential-types
 *
 * Provides LLMs with a reference of credential types,
 * how they map to AI nodes, and security considerations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CREDENTIAL_TYPES_DOC = `# a8n Credential Types Reference

Credentials store encrypted API keys for third-party services. They are linked to workflow nodes that require authentication.

## Available Types

| Type      | Used By          | Value Format                  |
|-----------|------------------|-------------------------------|
| OPENAI    | OPENAI node      | OpenAI API key (sk-...)       |
| ANTHROPIC | ANTHROPIC node   | Anthropic API key (sk-ant-...) |
| GEMINI    | GEMINI node      | Google AI API key              |
| SMTP_EMAIL | EMAIL node       | SMTP JSON with host, port, user, pass |
| GOOGLE_SHEETS | GOOGLE_SHEETS node | Google service-account JSON |

## Security Model

- Credential **values are encrypted** at rest using AES-256 (via Cryptr)
- The MCP server **never returns decrypted values** — only metadata (id, name, type, timestamps)
- Each credential is scoped to a single user
- Credentials are soft-referenced by nodes via \`credentialId\`

## Usage in Workflows

To use a credential-backed node in a workflow:
1. Create a credential of the matching type (e.g., OPENAI)
2. Create a workflow with a node requiring that credential (e.g., OPENAI, EMAIL, GOOGLE_SHEETS)
3. Link the credential to the node via its \`credentialId\` field
4. Configure the node's data fields (prompt, recipient, spreadsheet ID, etc.)

## MCP Operations

| Operation              | Tool                      | Scope              |
|------------------------|---------------------------|---------------------|
| List all credentials   | list_credentials          | credentials:read    |
| Get credential details | get_credential            | credentials:read    |
| Filter by type         | list_credentials_by_type  | credentials:read    |
| Create new credential  | create_credential         | credentials:write   |
| Update credential      | update_credential         | credentials:write   |
| Delete credential      | delete_credential         | credentials:write   |
`;

export function registerCredentialTypesResource(server: McpServer) {
  server.resource(
    "credential-types",
    "a8n://schema/credential-types",
    { description: "Credential type definitions, security model, and how credentials link to workflow nodes." },
    async () => ({
      contents: [
        {
          uri: "a8n://schema/credential-types",
          mimeType: "text/markdown",
          text: CREDENTIAL_TYPES_DOC,
        },
      ],
    }),
  );
}
