import { logger, normalizeError } from "@/lib/logging";
import type { LogFields } from "@/lib/logging";

export type WorkflowLogContext = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  workflowId?: string;
  executionId?: string;
  inngestEventId?: string;
  userId?: string;
  e2eMocked?: boolean;
};

export type WorkflowNodeLogContext = WorkflowLogContext & {
  nodeId: string;
  nodeType: string;
};

export function workflowLogFields(
  context: WorkflowLogContext,
  fields: LogFields = {},
): LogFields {
  return {
    component: "workflow",
    ...context,
    ...fields,
  };
}

export function logWorkflowInfo(
  event: string,
  message: string,
  context: WorkflowLogContext,
  fields: LogFields = {},
) {
  logger.info(
    workflowLogFields(context, {
      ...fields,
      event,
    }),
    message,
  );
}

export function logWorkflowError(
  event: string,
  message: string,
  error: unknown,
  context: WorkflowLogContext,
  fields: LogFields = {},
) {
  logger.error(
    workflowLogFields(context, {
      ...fields,
      event,
      error: normalizeError(error),
    }),
    message,
  );
}

export async function observeWorkflowNode<T>(
  context: WorkflowNodeLogContext,
  operation: () => Promise<T>,
): Promise<T> {
  const started = Date.now();

  logWorkflowInfo(
    "workflow_node_started",
    "Workflow node started.",
    context,
    {
      nodeId: context.nodeId,
      nodeType: context.nodeType,
    },
  );

  try {
    const result = await operation();
    logWorkflowInfo(
      "workflow_node_completed",
      "Workflow node completed.",
      context,
      {
        nodeId: context.nodeId,
        nodeType: context.nodeType,
        durationMs: Date.now() - started,
      },
    );

    return result;
  } catch (error) {
    logWorkflowError(
      "workflow_node_failed",
      "Workflow node failed.",
      error,
      context,
      {
        nodeId: context.nodeId,
        nodeType: context.nodeType,
        durationMs: Date.now() - started,
      },
    );

    throw error;
  }
}
