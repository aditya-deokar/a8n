import { expect, test } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { buildMinimalWorkflowGraph } from "../fixtures/workflow-graphs";
import { newSignedUpE2ERequestContext, signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  countWorkflowById,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getWorkflowById,
  seedE2EWorkflow,
} from "../helpers/db";
import {
  expectRejects,
  expectRejectsWithTrpcCode,
} from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

test.describe("backend E2E workflow lifecycle", () => {
  test.beforeEach(async () => {
    await cleanupE2EData();
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("pro test user creates a workflow through real HTTP", async ({ request }) => {
    const user = buildE2EUser("pro_workflow_create");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);

    const workflow = await trpc.workflows.create.mutate();

    expect(workflow).toMatchObject({
      userId: expect.any(String),
      name: expect.any(String),
    });
    expect(workflow.nodes).toBeUndefined();
  });

  test("free test user cannot create a premium workflow", async ({ request }) => {
    const user = buildE2EUser("free_workflow_create");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);

    await expectRejectsWithTrpcCode(trpc.workflows.create.mutate(), "FORBIDDEN");
  });

  test("lists and fetches only the signed-in user's workflow", async ({ request }) => {
    const user = buildE2EUser("workflow_list_get");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_list_get",
      userId: dbUser.id,
      name: "Lifecycle workflow",
    });
    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "lifecycle" }),
    ).resolves.toMatchObject({
      totalCount: 1,
      items: [expect.objectContaining({ id: "e2e_workflow_list_get" })],
    });

    await expect(
      trpc.workflows.getOne.query({ id: "e2e_workflow_list_get" }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_list_get",
      name: "Lifecycle workflow",
      nodes: [expect.objectContaining({ id: "e2e_workflow_list_get_node_initial" })],
      edges: [],
    });
  });

  test("renames a workflow and persists the change", async ({ request }) => {
    const user = buildE2EUser("workflow_rename");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_rename",
      userId: dbUser.id,
      name: "Old E2E Name",
    });
    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.workflows.updateName.mutate({
        id: "e2e_workflow_rename",
        name: "New E2E Name",
      }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_rename",
      name: "New E2E Name",
    });

    await expect(getWorkflowById("e2e_workflow_rename")).resolves.toMatchObject({
      name: "New E2E Name",
    });
  });

  test("saves a valid workflow graph atomically", async ({ request }) => {
    const user = buildE2EUser("workflow_graph_save");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_graph_save",
      userId: dbUser.id,
      name: "Graph Save",
    });
    const trpc = createE2ETrpcClient(request);
    const graph = buildMinimalWorkflowGraph();

    await expect(
      trpc.workflows.update.mutate({
        id: "e2e_workflow_graph_save",
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_graph_save",
    });

    const workflow = await getWorkflowById("e2e_workflow_graph_save");
    expect(workflow.nodes.map((node) => node.id).sort()).toEqual([
      "e2e_node_initial",
      "e2e_node_openai",
    ]);
    expect(workflow.connections).toHaveLength(1);
  });

  test("rejects invalid graph input without changing the existing graph", async ({ request }) => {
    const user = buildE2EUser("workflow_invalid_graph");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_invalid_graph",
      userId: dbUser.id,
      name: "Invalid Graph",
    });
    const before = await getWorkflowById("e2e_workflow_invalid_graph");
    const trpc = createE2ETrpcClient(request);

    await expectRejectsWithTrpcCode(
      trpc.workflows.update.mutate({
        id: "e2e_workflow_invalid_graph",
        nodes: [
          {
            id: "e2e_bad_node",
            type: "NOT_A_NODE",
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
      }),
      "BAD_REQUEST",
    );

    const after = await getWorkflowById("e2e_workflow_invalid_graph");
    expect(after.nodes.map((node) => node.id).sort()).toEqual(
      before.nodes.map((node) => node.id).sort(),
    );
    expect(after.connections).toHaveLength(before.connections.length);
  });

  test("deletes a workflow through real HTTP", async ({ request }) => {
    const user = buildE2EUser("workflow_delete");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_delete",
      userId: dbUser.id,
      name: "Delete Workflow",
    });
    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.workflows.remove.mutate({ id: "e2e_workflow_delete" }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_delete",
    });

    await expect(countWorkflowById("e2e_workflow_delete")).resolves.toBe(0);
    await expect(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "Delete Workflow" }),
    ).resolves.toMatchObject({
      totalCount: 0,
      items: [],
    });
  });

  test("another user cannot read, rename, save, or delete a workflow", async () => {
    const owner = buildE2EUser("workflow_owner");
    const attacker = buildE2EUser("workflow_attacker");
    const ownerContext = await newSignedUpE2ERequestContext(owner);
    const attackerContext = await newSignedUpE2ERequestContext(attacker);

    try {
      const ownerRecord = await findE2EUserByEmail(owner.email);
      await seedE2EWorkflow({
        id: "e2e_workflow_tenant_owned",
        userId: ownerRecord.id,
        name: "Tenant Owned Workflow",
      });
      const before = await getWorkflowById("e2e_workflow_tenant_owned");
      const attackerTrpc = createE2ETrpcClient(attackerContext);
      const graph = buildMinimalWorkflowGraph();

      await expectRejects(
        attackerTrpc.workflows.getOne.query({ id: "e2e_workflow_tenant_owned" }),
      );
      await expectRejects(
        attackerTrpc.workflows.updateName.mutate({
          id: "e2e_workflow_tenant_owned",
          name: "Stolen Workflow",
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.update.mutate({
          id: "e2e_workflow_tenant_owned",
          nodes: graph.nodes,
          edges: graph.edges,
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.remove.mutate({ id: "e2e_workflow_tenant_owned" }),
      );

      const after = await getWorkflowById("e2e_workflow_tenant_owned");
      expect(after.name).toBe("Tenant Owned Workflow");
      expect(after.nodes.map((node) => node.id).sort()).toEqual(
        before.nodes.map((node) => node.id).sort(),
      );
      expect(after.connections).toHaveLength(before.connections.length);
    } finally {
      await ownerContext.dispose();
      await attackerContext.dispose();
    }
  });
});
