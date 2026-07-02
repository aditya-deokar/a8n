import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const TENANT_GUARDS = [
  {
    category: "workflow list reads",
    file: "src/mcp/tools/workflows/list-workflows.tool.ts",
    patterns: [/where:\s*{[\s\S]*userId:\s*auth\.userId/],
  },
  {
    category: "workflow graph reads",
    file: "src/mcp/tools/workflows/get-workflow.tool.ts",
    patterns: [/where:\s*{\s*id:\s*args\.id,\s*userId:\s*auth\.userId\s*}/],
  },
  {
    category: "workflow drafts",
    file: "src/mcp/tools/workflows/workflow-drafts.tool.ts",
    patterns: [
      /function loadDraft\(draftId: string, userId: string\)[\s\S]*where:\s*{\s*id:\s*draftId,\s*userId\s*}/,
      /where:\s*{\s*id:\s*args\.workflowId,\s*userId:\s*auth\.userId\s*}/,
    ],
  },
  {
    category: "workflow versions",
    file: "src/mcp/tools/workflows/workflow-versioning.tool.ts",
    patterns: [
      /workflowVersion\.findMany\([\s\S]*where:\s*{\s*workflowId:\s*args\.workflowId,\s*userId:\s*auth\.userId\s*}/,
      /workflowVersion\.findUniqueOrThrow\([\s\S]*where:\s*{\s*id:\s*args\.versionId,\s*workflowId:\s*args\.workflowId,\s*userId:\s*auth\.userId\s*}/,
    ],
  },
  {
    category: "credentials",
    file: "src/mcp/tools/credentials/credential-tools.ts",
    patterns: [
      /const where = {[\s\S]*userId:\s*auth\.userId/,
      /where:\s*{\s*id:\s*args\.id,\s*userId:\s*auth\.userId\s*}/,
      /data:\s*{[\s\S]*userId:\s*auth\.userId/,
    ],
  },
  {
    category: "executions",
    file: "src/mcp/tools/executions/execution-tools.ts",
    patterns: [
      /const where = {\s*workflow:\s*{\s*userId:\s*auth\.userId\s*}\s*}/,
      /where:\s*{[\s\S]*id:\s*args\.id,[\s\S]*workflow:\s*{\s*userId:\s*auth\.userId\s*}/,
    ],
  },
  {
    category: "execution runtime",
    file: "src/mcp/tools/executions/execution-runtime-tools.ts",
    patterns: [
      /workflow:\s*{\s*userId:\s*params\.userId\s*}/,
      /where:\s*{\s*id:\s*args\.workflowId,\s*userId:\s*auth\.userId\s*}/,
      /where:\s*{\s*id:\s*args\.draftId,\s*userId:\s*auth\.userId\s*}/,
    ],
  },
  {
    category: "audit events",
    file: "src/mcp/tools/system/security-tools.ts",
    patterns: [/listPersistedAuditEvents\({[\s\S]*userId:\s*auth\.userId/],
  },
  {
    category: "app resources",
    file: "src/mcp/resources/app-resources.resource.ts",
    patterns: [
      /where:\s*{\s*id:\s*draftId,\s*userId\s*}/,
      /where:\s*{\s*id:\s*executionId,\s*workflow:\s*{\s*userId\s*}\s*}/,
      /getWorkflowGraph\(workflowId,\s*userId\)/,
    ],
  },
];

describe("MCP tenant isolation source guards", () => {
  it.each(TENANT_GUARDS)("$category keeps tenant predicates in route-facing handlers", ({ file, patterns }) => {
    const text = source(file);

    for (const pattern of patterns) {
      expect(text).toMatch(pattern);
    }
  });
});
