import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import prisma from "@/lib/db";
import { topologicalSort } from "./utils";
import { ExecutionStatus, NodeType, type Prisma } from "@/generated/prisma";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { httpRequestChannel } from "./channels/http-request";
import { manualTriggerChannel } from "./channels/manual-trigger";
import { googleFormTriggerChannel } from "./channels/google-form-trigger";
import { stripeTriggerChannel } from "./channels/stripe-trigger";
import { geminiChannel } from "./channels/gemini";
import { openAiChannel } from "./channels/openai";
import { anthropicChannel } from "./channels/anthropic";
import { discordChannel } from "./channels/discord";
import { slackChannel } from "./channels/slack";
import { emailChannel } from "./channels/email";
import { googleSheetsChannel } from "./channels/google-sheets";
import type { NodeExecutorParams, StepTools, WorkflowContext } from "@/features/executions/types";
import type { Realtime } from "@inngest/realtime";
import { runWithLogContext } from "@/lib/logging";
import {
  logWorkflowError,
  logWorkflowInfo,
  observeWorkflowNode,
  type WorkflowLogContext,
} from "./logging";
import {
  recordNodeRunFailure,
  recordNodeRunStart,
  recordNodeRunSuccess,
} from "./node-run-store";
import { publishNodeStatus } from "./node-status-publisher";

type WorkflowExecutionEvent = {
  id: string;
  data: {
    workflowId?: string;
    initialData?: WorkflowContext;
  } & Record<string, unknown>;
};

type WorkflowExecutionInput = {
  event: WorkflowExecutionEvent;
  step: StepTools;
  publish: NodeExecutorParams["publish"];
};

type WorkflowFailureInput = {
  event: {
    data: {
      event: {
        id: string;
        data?: {
          workflowId?: string;
        };
      };
      error: {
        message: string;
        stack?: string;
      };
    };
  };
};

function inngestFailureError(input: WorkflowFailureInput["event"]["data"]["error"]) {
  const error = new Error(input.message);
  error.stack = input.stack;
  return error;
}

export const executeWorkflow = inngest.createFunction(
  { 
    id: "execute-workflow",
    retries: process.env.NODE_ENV === "production" ? 3 : 0,
    onFailure: async (input: unknown) => {
      const { event } = input as WorkflowFailureInput;
      const workflowId = event.data.event.data?.workflowId;
      const inngestEventId = event.data.event.id;

      logWorkflowError(
        "workflow_execution_failed",
        "Workflow execution failed after retries.",
        inngestFailureError(event.data.error),
        {
          workflowId,
          inngestEventId,
        },
        {
          failureStage: "inngest_on_failure",
        },
      );

      // Mark the execution FAILED, tolerating the case where the run failed
      // before the execution row was ever created.
      try {
        await prisma.execution.update({
          where: { inngestEventId },
          data: {
            status: ExecutionStatus.FAILED,
            error: event.data.error.message,
            errorStack: event.data.error.stack,
          },
        });
      } catch (error) {
        logWorkflowError(
          "workflow_failure_status_update_failed",
          "Could not persist the failure status for the execution.",
          error,
          {
            workflowId,
            inngestEventId,
          },
        );
      }

      // Push error statuses to the canvas so nodes never stay stuck on
      // "loading" after a failed run. Best-effort only.
      if (!workflowId) return;
      try {
        const nodes = await prisma.node.findMany({
          where: { workflowId, type: { not: NodeType.INITIAL } },
          select: { id: true, type: true },
        });
        await Promise.allSettled(
          nodes.map((node) =>
            publishNodeStatus({
              eventId: inngestEventId,
              nodeType: node.type as NodeType,
              nodeId: node.id,
              status: "error",
            }),
          ),
        );
      } catch {
        // Never mask the original failure.
      }
    },
    triggers: [{ event: "workflows/execute.workflow" }],
    channels: [
      httpRequestChannel(),
      manualTriggerChannel(),
      googleFormTriggerChannel(),
      stripeTriggerChannel(),
      geminiChannel(),
      openAiChannel(),
      anthropicChannel(),
      discordChannel(),
      slackChannel(),
      emailChannel(),
      googleSheetsChannel(),
    ],
  } as unknown as Parameters<typeof inngest.createFunction>[0],
  async (input: unknown) => {
    const { event, step, publish } = input as WorkflowExecutionInput;
    const inngestEventId = event.id;
    const workflowId = event.data.workflowId;
    const started = Date.now();

    if (!inngestEventId || !workflowId) {
      logWorkflowError(
        "workflow_execution_failed",
        "Workflow execution event is missing required identifiers.",
        new NonRetriableError("Event ID or workflow ID is missing"),
        {
          workflowId,
          inngestEventId,
        },
        {
          failureStage: "validation",
        },
      );

      throw new NonRetriableError("Event ID or workflow ID is missing");
    }

    return runWithLogContext(
      {
        component: "workflow",
        workflowId,
        inngestEventId,
      },
      async () => {
        let executionId: string | undefined;
        let userId: string | undefined;
        const baseLogContext: WorkflowLogContext = {
          workflowId,
          inngestEventId,
        };

        logWorkflowInfo(
          "workflow_execution_started",
          "Workflow execution started.",
          baseLogContext,
        );

        try {
          const execution = await step.run("create-execution", async () => {
            return prisma.execution.create({
              data: {
                workflowId,
                inngestEventId,
              },
            });
          });

          executionId = execution.id;

          const sortedNodes = await step.run("prepare-workflow", async () => {
            const workflow = await prisma.workflow.findUniqueOrThrow({
              where: { id: workflowId },
              include: {
                nodes: true,
                connections: true,
              },
            });

            return topologicalSort(workflow.nodes, workflow.connections);
          });

          const resolvedUserId = await step.run("find-user-id", async () => {
            const workflow = await prisma.workflow.findUniqueOrThrow({
              where: { id: workflowId },
              select: {
                userId: true,
              },
            });

            return workflow.userId;
          });
          userId = resolvedUserId;

          const executionLogContext: WorkflowLogContext = {
            workflowId,
            inngestEventId,
            executionId,
            userId: resolvedUserId,
          };

          logWorkflowInfo(
            "workflow_execution_prepared",
            "Workflow execution prepared.",
            executionLogContext,
            {
              nodeCount: sortedNodes.length,
            },
          );

          // Initialize context with any initial data from the trigger.
          let context: WorkflowContext = event.data.initialData || {};

          // Execute each node without logging node data, prompts, outputs, or credentials.
          for (const node of sortedNodes) {
            const executor = getExecutor(node.type as NodeType);
            const nodeStartedAt = Date.now();

            await recordNodeRunStart({
              executionId,
              nodeId: node.id,
              nodeType: node.type as NodeType,
            });

            try {
              context = await observeWorkflowNode(
                {
                  ...executionLogContext,
                  nodeId: node.id,
                  nodeType: String(node.type),
                },
                () =>
                  executor({
                    data: node.data as Record<string, unknown>,
                    nodeId: node.id,
                    userId: resolvedUserId,
                    context,
                    step,
                    publish: publish as NodeExecutorParams["publish"] &
                      Realtime.PublishFn,
                  }),
              );
              await recordNodeRunSuccess({
                executionId,
                nodeId: node.id,
                durationMs: Date.now() - nodeStartedAt,
              });
            } catch (error) {
              await recordNodeRunFailure({
                executionId,
                nodeId: node.id,
                durationMs: Date.now() - nodeStartedAt,
                errorMessage:
                  error instanceof Error ? error.message : String(error),
              });
              throw error;
            }
          }

          await step.run("update-execution", async () => {
            return prisma.execution.update({
              where: { inngestEventId, workflowId },
              data: {
                status: ExecutionStatus.SUCCESS,
                completedAt: new Date(),
                output: context as Prisma.InputJsonValue,
              },
            });
          });

          logWorkflowInfo(
            "workflow_execution_completed",
            "Workflow execution completed.",
            executionLogContext,
            {
              durationMs: Date.now() - started,
              nodeCount: sortedNodes.length,
            },
          );

          return {
            workflowId,
            result: context,
          };
        } catch (error) {
          logWorkflowError(
            "workflow_execution_failed",
            "Workflow execution failed.",
            error,
            {
              workflowId,
              inngestEventId,
              executionId,
              userId,
            },
            {
              durationMs: Date.now() - started,
            },
          );

          throw error;
        }
      },
    );
  },
);
