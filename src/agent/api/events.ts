import { randomUUID } from "node:crypto";

export type AgentEventType =
  | "run.started"
  | "message.started"
  | "message.delta"
  | "message.completed"
  | "tool.call.started"
  | "tool.call.completed"
  | "draft.updated"
  | "validation.updated"
  | "approval.requested"
  | "approval.resolved"
  | "workflow.applied"
  | "run.paused"
  | "run.completed"
  | "run.failed"
  | "run.cancelled";

export type AgentEvent = {
  type: AgentEventType;
  eventId: string;
  runId: string;
  threadId: string;
  sequence: number;
  timestamp: string;
  correlationId: string;
  payload: Record<string, unknown>;
};

export function createAgentEvent(params: {
  type: AgentEventType;
  runId: string;
  threadId: string;
  sequence: number;
  correlationId: string;
  payload?: Record<string, unknown>;
}): AgentEvent {
  return {
    type: params.type,
    eventId: randomUUID(),
    runId: params.runId,
    threadId: params.threadId,
    sequence: params.sequence,
    timestamp: new Date().toISOString(),
    correlationId: params.correlationId,
    payload: params.payload || {},
  };
}

export function encodeSseEvent(event: AgentEvent): string {
  return `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
