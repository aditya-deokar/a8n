import { describe, expect, it } from "vitest";
import { logger } from "@/lib/logging";
import { observeWorkflowNode, workflowLogFields } from "@/inngest/logging";

function captureWorkflowLogs() {
  const events = [];
  const original = {
    info: logger.info,
    error: logger.error,
  };

  logger.info = (fields, message) => {
    events.push({ level: "info", fields, message });
  };
  logger.error = (fields, message) => {
    events.push({ level: "error", fields, message });
  };

  return {
    events,
    restore() {
      Object.assign(logger, original);
    },
  };
}

describe("workflow logging", () => {
  it("builds workflow log fields without workflow payload data", () => {
    expect(
      workflowLogFields(
        {
          workflowId: "workflow_1",
          executionId: "execution_1",
          inngestEventId: "event_1",
        },
        {
          event: "workflow_execution_completed",
          durationMs: 42,
        },
      ),
    ).toEqual({
      component: "workflow",
      workflowId: "workflow_1",
      executionId: "execution_1",
      inngestEventId: "event_1",
      event: "workflow_execution_completed",
      durationMs: 42,
    });
  });

  it("logs workflow node completion metadata", async () => {
    const capture = captureWorkflowLogs();

    try {
      await expect(
        observeWorkflowNode(
          {
            workflowId: "workflow_1",
            executionId: "execution_1",
            inngestEventId: "event_1",
            nodeId: "node_1",
            nodeType: "OPENAI",
          },
          async () => ({ result: "not logged" }),
        ),
      ).resolves.toEqual({ result: "not logged" });

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "info",
          fields: expect.objectContaining({
            component: "workflow",
            event: "workflow_node_started",
            nodeId: "node_1",
            nodeType: "OPENAI",
          }),
        }),
      );
      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "info",
          fields: expect.objectContaining({
            component: "workflow",
            event: "workflow_node_completed",
            nodeId: "node_1",
            nodeType: "OPENAI",
          }),
        }),
      );
      expect(JSON.stringify(capture.events)).not.toContain("not logged");
    } finally {
      capture.restore();
    }
  });

  it("logs workflow node failures with normalized safe errors", async () => {
    const capture = captureWorkflowLogs();

    try {
      await expect(
        observeWorkflowNode(
          {
            workflowId: "workflow_1",
            executionId: "execution_1",
            inngestEventId: "event_1",
            nodeId: "node_1",
            nodeType: "HTTP_REQUEST",
          },
          async () => {
            throw new Error("failed with Bearer abcdefghijklmno");
          },
        ),
      ).rejects.toThrow("failed");

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "error",
          fields: expect.objectContaining({
            component: "workflow",
            event: "workflow_node_failed",
            error: expect.objectContaining({
              message: "failed with Bearer [REDACTED]",
            }),
            nodeId: "node_1",
            nodeType: "HTTP_REQUEST",
          }),
        }),
      );
    } finally {
      capture.restore();
    }
  });
});
