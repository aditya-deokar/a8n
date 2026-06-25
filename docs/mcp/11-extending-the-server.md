# Extending the MCP Server

> **Audience:** Contributors adding tools, resources, or prompts  
> **Prerequisites:** [04 — Architecture](./04-architecture.md), [06 — Tools Reference](./06-tools-reference.md)  
> **Last Updated:** June 24, 2026

---

## What you'll learn

- How to add a new MCP tool
- How to add a resource or prompt
- Testing and documentation checklist

---

## Adding a new tool

### Step 1 — Choose a domain folder

| Domain | Folder | Registry |
|---|---|---|
| Workflows | `src/mcp/tools/workflows/` | `workflows/index.ts` |
| Credentials | `src/mcp/tools/credentials/` | `credentials/index.ts` |
| Executions | `src/mcp/tools/executions/` | `executions/index.ts` |
| Nodes | `src/mcp/tools/nodes/` | `nodes/index.ts` |
| System | `src/mcp/tools/system/` | `system/index.ts` |
| API Keys | `src/mcp/tools/api-keys/` | `api-keys/index.ts` |

For a new domain, create a folder + `index.ts` and import in `tools/_registry.ts`.

### Step 2 — Create the tool file

Example: `src/mcp/tools/workflows/duplicate-workflow.tool.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import type { McpAuthInfo } from "@/mcp/auth/types";

export function registerDuplicateWorkflow(server: McpServer) {
  server.tool(
    "duplicate_workflow",
    "Create a copy of an existing workflow.",
    {
      id: z.string().describe("Workflow ID to duplicate"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "duplicate_workflow",
        input: args,
      });

      return withErrorBoundary("duplicate_workflow", async () => {
        // Implementation...
        audit.success();
        return mcpJsonResponse({ /* result */ });
      });
    },
  );
}
```

### Step 3 — Register in domain index

```typescript
// workflows/index.ts
import { registerDuplicateWorkflow } from "./duplicate-workflow.tool";

export function registerWorkflowTools(server: McpServer) {
  // ...existing registrations
  registerDuplicateWorkflow(server);
}
```

### Step 4 — Add scope (if new permission needed)

If the tool needs a new permission, add to `src/mcp/auth/scopes.ts`:

```typescript
"workflows:duplicate": "Duplicate existing workflows",
```

Otherwise reuse an existing scope.

### Step 5 — Update documentation

- [ ] Add entry to [06 — Tools Reference](./06-tools-reference.md)
- [ ] Update embedded `api-docs.resource.ts` if maintaining parity
- [ ] Update tool count in `tools/_registry.ts` comment

---

## Adding a new resource

### Step 1 — Create resource file

`src/mcp/resources/my-schema.resource.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CONTENT = `# My Schema\n\n...markdown...`;

export function registerMySchemaResource(server: McpServer) {
  server.resource(
    "my-schema",
    "a8n://schema/my-schema",
    { description: "Description for tools/list" },
    async () => ({
      contents: [{ uri: "a8n://schema/my-schema", mimeType: "text/markdown", text: CONTENT }],
    }),
  );
}
```

### Step 2 — Register in `resources/_registry.ts`

```typescript
import { registerMySchemaResource } from "./my-schema.resource";

export function registerAllResources(server: McpServer) {
  // ...existing
  registerMySchemaResource(server);
}
```

### Step 3 — Document in [07 — Resources & Prompts](./07-resources-and-prompts.md)

---

## Adding a new prompt

### Step 1 — Create prompt file

`src/mcp/prompts/my-prompt.prompt.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMyPrompt(server: McpServer) {
  server.prompt(
    "my_prompt",
    "Description shown in prompts/list",
    {
      argName: z.string().describe("Argument description"),
    },
    async (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Guided instructions using ${args.argName}...`,
          },
        },
      ],
    }),
  );
}
```

### Step 2 — Register in `prompts/_registry.ts`

---

## Extension checklist

Before merging a new MCP capability:

- [ ] **Scope:** `requireScope()` called with correct permission
- [ ] **Auth:** Queries filtered by `auth.userId`
- [ ] **Secrets:** No raw credential values in responses; use `SAFE_CREDENTIAL_SELECT`
- [ ] **Sanitize:** `sanitizeOutput()` on all responses; `sanitizeInput()` in audit
- [ ] **Audit:** `createAuditContext` + `audit.success()` / `audit.fail()`
- [ ] **Errors:** Wrapped in `withErrorBoundary()`
- [ ] **Zod:** All inputs have `.describe()` for LLM schema discovery
- [ ] **Docs:** Updated tools reference and hub README counts
- [ ] **Test:** Verified with MCP Inspector

---

## Testing with MCP Inspector

```bash
pnpm dev
npx @modelcontextprotocol/inspector
```

1. Transport: **Streamable HTTP**
2. URL: `http://localhost:3000/api/mcp`
3. Headers: `Authorization: Bearer a8n_mcp_<key>`
4. Call `health_check` → `tools/list` → your new tool

Or use the seed script:

```bash
npx tsx scripts/mcp-seed-key.ts
```

---

## Anti-patterns

| Avoid | Why |
|---|---|
| Returning credential `value` | Security violation |
| Skipping `requireScope` | Bypasses permission model |
| Calling tRPC from tools | Couples to session context; use Prisma or shared services |
| Partial `update_workflow` patches | Tool semantics are full replacement |
| Wildcard scopes in examples | Encourages insecure production setup |

---

## Next steps

- [04 — Architecture](./04-architecture.md)
- [09 — Design Decisions](./09-design-decisions.md)

---

<div align="center">
  <sub>Part of the a8n MCP documentation series</sub>
</div>
