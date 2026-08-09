/**
 * Shared types for the agent chat interface.
 *
 * These types are used by both the workflow-editor agent sidebar
 * (`src/features/editor/components/agent-sidebar.tsx`) and the
 * standalone agent chat page (`src/features/agent/components/`).
 *
 * Extracted from the inline type definitions that were originally
 * in agent-sidebar.tsx.
 */

/**
 * Tool call activity tracked inline in chat messages.
 */
export interface ToolActivity {
  name: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
}

/**
 * A single message in the agent chat conversation.
 * Supports both user and agent messages with streaming state,
 * tool activity, draft preview, and approval flow.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  isStreaming?: boolean;
  approvalId?: string;
  preview?: any;
  toolActivity?: ToolActivity[];
  error?: { code: string; message: string };
  runStatus?: "started" | "completed" | "failed" | "cancelled";
}

/**
 * Agent run status for UI state management.
 */
export type AgentRunStatus = "idle" | "streaming" | "paused" | "error";

/**
 * Serialized agent thread for the UI layer.
 * Matches the shape returned by the `agent.listThreads` tRPC query.
 */
export interface AgentThread {
  id: string;
  langgraphThreadId: string;
  workflowId: string | null;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED";
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}
