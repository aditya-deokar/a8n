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
import { runWithLogContext } from "@/lib/logging";
import {
  logWorkflowError,
  logWorkflowInfo,
  observeWorkflowNode,
  type WorkflowLogContext,
} from "./logging";

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

type LegacyInngestApi = {
  inngestApi: {
    publish: (
      options: {
        topics: string[];
        channel: string;
        runId: string;
      },
      data: unknown,
    ) => Promise<{ ok: boolean }>;
  };
};

type PublishInput = Parameters<NodeExecutorParams["publish"]>[0];

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

      logWorkflowError(
        "workflow_execution_failed",
        "Workflow execution failed after retries.",
        inngestFailureError(event.data.error),
        {
          workflowId,
          inngestEventId: event.data.event.id,
        },
        {
          failureStage: "inngest_on_failure",
        },
      );

      return prisma.execution.update({
        where: { inngestEventId: event.data.event.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: event.data.error.message,
          errorStack: event.data.error.stack,
        },
      });
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
    const { event, step } = input as WorkflowExecutionInput;
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

          // Shim for legacy @inngest/realtime middleware publish.
          const publish: NodeExecutorParams["publish"] = async (input: PublishInput) => {
            const { topic, channel, data } = await input;
            const publishOpts = {
              topics: [topic],
              channel,
              runId: event.id,
            };

            const result = await (inngest as unknown as LegacyInngestApi).inngestApi.publish(
              publishOpts,
              data,
            );
            if (!result.ok) throw new Error("Failed to publish event to realtime");
            return data;
          };

          // Execute each node without logging node data, prompts, outputs, or credentials.
          for (const node of sortedNodes) {
            const executor = getExecutor(node.type as NodeType);
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
                  publish,
                }),
            );
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
