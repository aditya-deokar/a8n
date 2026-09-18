/**
 * Contract annotations → registered tools.
 *
 * The tool contract manifest declares `readOnlyHint`, `destructiveHint`,
 * `idempotentHint` and `openWorldHint` for every tool, but most tools are
 * registered through the SDK's `server.tool(name, description, schema, handler)`
 * overload, which has no annotations parameter. The declared hints therefore
 * never reached clients.
 *
 * That matters across clients: hosts use `readOnlyHint` and `destructiveHint`
 * to decide what can run without a confirmation prompt and how to label a call.
 * With no annotations, a read-only tool like `list_workflows` looks exactly as
 * risky as `delete_workflow`.
 *
 * Rather than rewrite ~45 registration call sites, this applies the contract's
 * annotations to the registered tool objects after registration. Tools that
 * registered their own annotations (the widget render tools) are left alone.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToolContract } from "@/mcp/contracts/tools.manifest";

type RegisteredTool = {
  annotations?: Record<string, unknown>;
};

type ServerWithTools = {
  _registeredTools?: Record<string, RegisteredTool>;
};

/** Drop undefined hints so clients see only what the contract actually states. */
function definedHints(
  annotations: Record<string, boolean | undefined>,
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(annotations).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

export function applyContractAnnotations(server: McpServer): number {
  const registered = (server as unknown as ServerWithTools)._registeredTools;
  if (!registered) return 0;

  let applied = 0;
  for (const [name, tool] of Object.entries(registered)) {
    if (tool.annotations) continue;

    const contract = getToolContract(name);
    if (!contract) continue;

    const hints = definedHints({
      ...contract.annotations,
      // A tool with an external side effect reaches outside this system, which
      // is exactly what openWorldHint describes.
      openWorldHint: contract.annotations.openWorldHint ?? contract.externalSideEffect,
    });
    if (Object.keys(hints).length === 0) continue;

    tool.annotations = { title: contract.name, ...hints };
    applied += 1;
  }

  return applied;
}
