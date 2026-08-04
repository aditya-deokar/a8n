import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createMcpServer } from "@/mcp";
import type { McpAuthInfo } from "@/mcp/auth/types";
import type { McpAppProfile } from "@/mcp/app-profile";
import { getToolContract } from "@/mcp/contracts/tools.manifest";
import { AgentError } from "@/agent/errors";
import {
  EMBEDDED_AGENT_TOOL_NAMES,
  assertEmbeddedAgentToolAllowed,
  assertEmbeddedAgentToolSet,
} from "./tool-policy";
import { agentSpan } from "@/agent/observability/tracing";
import { recordToolCall } from "@/agent/observability/metrics";

export type EmbeddedMcpClientOptions = {
  authInfo: McpAuthInfo;
  appProfile?: Extract<McpAppProfile, "embedded_agent">;
  allowDraftWrites?: boolean;
  allowApply?: boolean;
  maxToolCalls?: number;
  /** Called when a tool invocation starts; used to emit tool.call.started events. */
  onToolCallStarted?: (toolName: string) => void;
};

export type EmbeddedMcpClient = {
  tools: DynamicStructuredTool[];
  toolNames: string[];
  close: () => Promise<void>;
};

function safeToolDescription(description: string | undefined): string {
  return (description || "a8n MCP tool")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
}

export async function createEmbeddedMcpClient(
  options: EmbeddedMcpClientOptions,
): Promise<EmbeddedMcpClient> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(options.authInfo, {
    appProfile: options.appProfile || "embedded_agent",
  });
  const client = new Client(
    { name: "a8n-embedded-agent", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const discoveredTools = await loadMcpTools("a8n", client, {
      throwOnLoadError: true,
      defaultToolTimeout: 15_000,
    });

    const discoveredByName = new Map(
      discoveredTools.map((tool) => [tool.name, tool]),
    );
    const selectedNames = [...EMBEDDED_AGENT_TOOL_NAMES].filter((name) =>
      discoveredByName.has(name),
    );

    if (selectedNames.length === 0) {
      throw new AgentError(
        "AGENT_TOOL_NOT_ALLOWED",
        "The embedded MCP server exposed no approved tools.",
      );
    }

    const selectedTools = selectedNames.map((name) => discoveredByName.get(name)!);
    assertEmbeddedAgentToolSet(selectedTools, {
      allowDraftWrites: options.allowDraftWrites,
      allowApply: options.allowApply,
    });

    let toolCalls = 0;
    const maxToolCalls = options.maxToolCalls || 30;
    const tools = selectedTools.map(
      (sourceTool) =>
        new DynamicStructuredTool({
          name: sourceTool.name,
          description: safeToolDescription(sourceTool.description),
          schema: sourceTool.schema,
          func: async (input) => {
            assertEmbeddedAgentToolAllowed(sourceTool.name, {
              allowDraftWrites: options.allowDraftWrites,
              allowApply: options.allowApply,
            });
            toolCalls += 1;
            if (toolCalls > maxToolCalls) {
              throw new AgentError(
                "AGENT_RUN_LIMIT_EXCEEDED",
                "The agent reached its tool-call budget.",
              );
            }

            const contract = getToolContract(sourceTool.name);
            if (!contract) {
              throw new AgentError(
                "AGENT_TOOL_NOT_ALLOWED",
                `Missing MCP contract for ${sourceTool.name}.`,
              );
            }

            options.onToolCallStarted?.(sourceTool.name);

            const toolStartedAt = Date.now();
            try {
              const result = await agentSpan(
                `tool.call.${sourceTool.name}`,
                {
                  toolName: sourceTool.name,
                  userId: options.authInfo.userId,
                },
                () => sourceTool.invoke(input),
              );

              recordToolCall({
                userId: options.authInfo.userId,
                runId: "unknown",
                toolName: sourceTool.name,
                durationMs: Date.now() - toolStartedAt,
                status: "completed",
              });

              return result;
            } catch (error) {
              recordToolCall({
                userId: options.authInfo.userId,
                runId: "unknown",
                toolName: sourceTool.name,
                durationMs: Date.now() - toolStartedAt,
                status: "failed",
              });
              throw error;
            }
          },
        }),
    );

    return {
      tools,
      toolNames: tools.map((tool) => tool.name),
      close: async () => {
        await client.close();
        await server.close();
      },
    };
  } catch (error) {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    if (error instanceof AgentError) throw error;
    throw new AgentError(
      "AGENT_TOOL_NOT_ALLOWED",
      "Unable to initialize the embedded MCP client.",
      { cause: error },
    );
  }
}
