import {
  CHATGPT_TOOL_CONTRACTS,
  FORBIDDEN_CHATGPT_TOOL_CONTRACTS,
} from "@/mcp/contracts/tools.manifest";
import type { McpToolPolicy, McpToolRisk } from "@/mcp/contracts/types";

export type { McpToolPolicy, McpToolRisk };

export const CHATGPT_APP_TOOL_POLICY = Object.fromEntries(
  CHATGPT_TOOL_CONTRACTS.map((tool) => [
    tool.name,
    {
      risk: tool.risk,
      requiresApproval: tool.requiresApproval,
      chatGptMvp: true,
      note: tool.note,
    } satisfies McpToolPolicy,
  ]),
) as Record<string, McpToolPolicy>;

export const CHATGPT_APP_TOOL_COUNT = Object.keys(CHATGPT_APP_TOOL_POLICY).length;

export const CHATGPT_FORBIDDEN_TOOLS = FORBIDDEN_CHATGPT_TOOL_CONTRACTS.map(
  (tool) => tool.name,
);

export function getChatGptToolPolicy(toolName: string): McpToolPolicy | null {
  return CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY] || null;
}

export function isForbiddenInChatGptProfile(toolName: string): boolean {
  return CHATGPT_FORBIDDEN_TOOLS.includes(toolName as (typeof CHATGPT_FORBIDDEN_TOOLS)[number]);
}
