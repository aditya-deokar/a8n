import type { McpAuthInfo } from "@/mcp/auth/types";

export type AgentContext = {
  userId: string;
  userName?: string;
  userEmail?: string;
  workflowId?: string;
  threadId: string;
  langgraphThreadId: string;
  correlationId: string;
  authInfo: McpAuthInfo;
};

export type SanitizedWorkflowContext = {
  id: string;
  name: string;
  updatedAt: string;
  nodeTypes: string[];
  nodeCount: number;
  connectionCount: number;
};
