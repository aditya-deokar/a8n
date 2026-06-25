/**
 * Resource: a8n://schema/credential-types
 *
 * Generated from the credential manifest so MCP clients see the same
 * credential model as node planning and validation code.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CREDENTIAL_TYPE_MANIFESTS } from "@/features/workflows/node-manifest";

function buildCredentialTypesDoc(): string {
  const rows = CREDENTIAL_TYPE_MANIFESTS.map((credential) => {
    return `| ${credential.type} | ${credential.label} | ${credential.usedBy.join(", ")} | ${credential.valueFormat} |`;
  }).join("\n");

  return `# a8n Credential Types Reference

Credentials store encrypted secrets for third-party services. MCP tools never return decrypted credential values.

Total credential types: ${CREDENTIAL_TYPE_MANIFESTS.length}

| Type | Label | Used by nodes | Value format |
|---|---|---|---|
${rows}

## Security Model

- Credential values are encrypted at rest.
- MCP returns only credential metadata, never decrypted values.
- Each credential belongs to one user.
- Nodes reference credentials by \`credentialId\`.
- Use \`a8n://catalog/credentials\` for machine-readable credential metadata.

## MCP Operations

| Operation | Tool | Scope |
|---|---|---|
| List all credentials | list_credentials | credentials:read |
| Get credential metadata | get_credential | credentials:read |
| Filter by type | list_credentials_by_type | credentials:read |
| Create credential | create_credential | credentials:write |
| Update credential | update_credential | credentials:write |
| Delete credential | delete_credential | credentials:write |
`;
}

export function registerCredentialTypesResource(server: McpServer) {
  server.resource(
    "credential-types",
    "a8n://schema/credential-types",
    {
      description:
        "Credential type definitions, value formats, security model, and node mappings.",
    },
    async () => ({
      contents: [
        {
          uri: "a8n://schema/credential-types",
          mimeType: "text/markdown",
          text: buildCredentialTypesDoc(),
        },
      ],
    }),
  );
}
