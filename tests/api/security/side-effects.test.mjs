import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";
import {
  createAppCaller,
  resetApiTestMocks,
  sendWorkflowExecutionMock,
  setApiUser,
} from "../helpers/trpc-caller.mjs";

describe("side-effect ordering regression coverage", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("dispatches workflow execution only after ownership lookup succeeds", async () => {
    const caller = await createAppCaller();

    await caller.workflows.execute({ id: "workflow_a" });

    expect(prismaMock.workflow.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "workflow_a",
        userId: apiUsers.userAPro.id,
      },
    });
    expect(sendWorkflowExecutionMock).toHaveBeenCalledWith({
      workflowId: "workflow_a",
      userId: apiUsers.userAPro.id,
    });
  });

  it("does not dispatch workflow execution when ownership lookup fails", async () => {
    prismaMock.workflow.findUniqueOrThrow.mockRejectedValue(new Error("not found"));
    const caller = await createAppCaller();

    await expect(caller.workflows.execute({ id: "workflow_b" })).rejects.toThrow("not found");

    expect(sendWorkflowExecutionMock).not.toHaveBeenCalled();
  });

  it("does not write graph data when graph input validation fails", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.update({
        id: "workflow_a",
        nodes: [
          {
            id: "node_bad",
            type: "NOT_A_NODE",
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(prismaMock.workflow.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.node.createMany).not.toHaveBeenCalled();
    expect(prismaMock.connection.createMany).not.toHaveBeenCalled();
  });
});
