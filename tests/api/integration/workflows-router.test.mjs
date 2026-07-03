import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildWorkflow, fixtureDate } from "../fixtures/factories.mjs";
import {
  createAppCaller,
  expectTrpcCode,
  resetApiTestMocks,
  sendWorkflowExecutionMock,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

describe("workflows router integration", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("creates a workflow with an initial node for the current premium user", async () => {
    setPremiumSubscription(true);
    const caller = await createAppCaller();

    const workflow = await caller.workflows.create();

    expect(workflow).toMatchObject({
      id: "workflow_created",
      userId: apiUsers.userAPro.id,
    });
    expect(prismaMock.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: apiUsers.userAPro.id,
          nodes: {
            create: expect.objectContaining({
              type: "INITIAL",
              position: { x: 0, y: 0 },
            }),
          },
        }),
      }),
    );
  });

  it("lists only current-user workflows with search, pagination, and descending update order", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.getMany({ page: 2, pageSize: 5, search: "invoice" }),
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 5,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: true,
    });

    expect(prismaMock.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          userId: apiUsers.userAPro.id,
          name: { contains: "invoice", mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
    expect(prismaMock.workflow.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: apiUsers.userAPro.id,
          name: { contains: "invoice", mode: "insensitive" },
        },
      }),
    );
  });

  it("returns a React Flow shaped workflow graph", async () => {
    prismaMock.workflow.findUniqueOrThrow.mockResolvedValue(
      buildWorkflow({
        nodes: [
          {
            id: "node_a",
            type: "INITIAL",
            position: { x: 10, y: 20 },
            data: { label: "Start" },
          },
          {
            id: "node_b",
            type: "OPENAI",
            position: { x: 200, y: 20 },
            data: { model: "test" },
          },
        ],
        connections: [
          {
            id: "connection_a",
            fromNodeId: "node_a",
            toNodeId: "node_b",
            fromOutput: "main",
            toInput: "main",
          },
        ],
      }),
    );
    const caller = await createAppCaller();

    await expect(caller.workflows.getOne({ id: "workflow_a" })).resolves.toEqual({
      id: "workflow_a",
      name: "Primary workflow",
      nodes: [
        {
          id: "node_a",
          type: "INITIAL",
          position: { x: 10, y: 20 },
          data: { label: "Start" },
        },
        {
          id: "node_b",
          type: "OPENAI",
          position: { x: 200, y: 20 },
          data: { model: "test" },
        },
      ],
      edges: [
        {
          id: "connection_a",
          source: "node_a",
          target: "node_b",
          sourceHandle: "main",
          targetHandle: "main",
        },
      ],
    });
    expect(prismaMock.workflow.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workflow_a", userId: apiUsers.userAPro.id },
        include: { nodes: true, connections: true },
      }),
    );
  });

  it("replaces graph nodes and edges in one transaction", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.update({
        id: "workflow_a",
        nodes: [
          {
            id: "node_a",
            type: "INITIAL",
            position: { x: 0, y: 0 },
            data: { label: "Start" },
          },
          {
            id: "node_b",
            type: "OPENAI",
            position: { x: 100, y: 0 },
            data: { prompt: "Summarize" },
          },
        ],
        edges: [
          {
            source: "node_a",
            target: "node_b",
            sourceHandle: null,
            targetHandle: null,
          },
        ],
      }),
    ).resolves.toMatchObject({ id: "workflow_a" });

    expect(prismaMock.workflow.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "workflow_a", userId: apiUsers.userAPro.id },
    });
    expect(prismaMock.node.deleteMany).toHaveBeenCalledWith({
      where: { workflowId: "workflow_a" },
    });
    expect(prismaMock.node.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "node_a",
          workflowId: "workflow_a",
          name: "INITIAL",
          type: "INITIAL",
          position: { x: 0, y: 0 },
          data: { label: "Start" },
        },
        {
          id: "node_b",
          workflowId: "workflow_a",
          name: "OPENAI",
          type: "OPENAI",
          position: { x: 100, y: 0 },
          data: { prompt: "Summarize" },
        },
      ],
    });
    expect(prismaMock.connection.createMany).toHaveBeenCalledWith({
      data: [
        {
          workflowId: "workflow_a",
          fromNodeId: "node_a",
          toNodeId: "node_b",
          fromOutput: "main",
          toInput: "main",
        },
      ],
    });
    expect(prismaMock.workflow.update).toHaveBeenCalledWith({
      where: { id: "workflow_a" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("rejects unknown node types before opening a graph transaction", async () => {
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
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("renames only the current user's workflow", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.updateName({ id: "workflow_a", name: "Updated workflow" }),
    ).resolves.toMatchObject({ name: "Updated workflow" });

    expect(prismaMock.workflow.update).toHaveBeenCalledWith({
      where: { id: "workflow_a", userId: apiUsers.userAPro.id },
      data: { name: "Updated workflow" },
    });
  });

  it("checks ownership before dispatching workflow execution", async () => {
    const caller = await createAppCaller();

    await expect(caller.workflows.execute({ id: "workflow_a" })).resolves.toMatchObject({
      id: "workflow_a",
    });

    expect(prismaMock.workflow.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "workflow_a", userId: apiUsers.userAPro.id },
    });
    expect(sendWorkflowExecutionMock).toHaveBeenCalledWith({ workflowId: "workflow_a" });
  });

  it("does not dispatch workflow execution when ownership lookup fails", async () => {
    prismaMock.workflow.findUniqueOrThrow.mockRejectedValue(new Error("Not found"));
    const caller = await createAppCaller();

    await expect(caller.workflows.execute({ id: "workflow_b" })).rejects.toThrow("Not found");
    expect(sendWorkflowExecutionMock).not.toHaveBeenCalled();
  });

  it("deletes only the current user's workflow", async () => {
    prismaMock.workflow.delete.mockResolvedValue(
      buildWorkflow({ id: "workflow_delete", name: "Delete me", updatedAt: fixtureDate }),
    );
    const caller = await createAppCaller();

    await expect(caller.workflows.remove({ id: "workflow_delete" })).resolves.toMatchObject({
      id: "workflow_delete",
      name: "Delete me",
    });

    expect(prismaMock.workflow.delete).toHaveBeenCalledWith({
      where: { id: "workflow_delete", userId: apiUsers.userAPro.id },
    });
  });
});
