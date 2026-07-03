import { expect, test } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { buildMinimalWorkflowGraph } from "../fixtures/workflow-graphs";
import { postRawJson } from "../helpers/api-client";
import { signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getWorkflowById,
  seedE2ECredential,
  seedE2EWorkflow,
} from "../helpers/db";
import {
  expectNoSecretLeakInResponse,
  expectRejectsWithTrpcCode,
} from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

test.describe("backend E2E tRPC transport", () => {
  test.beforeEach(async () => {
    await cleanupE2EData();
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("executes a real protected tRPC query over HTTP", async ({ request }) => {
    const user = buildE2EUser("trpc_query");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_query",
      userId: dbUser.id,
      name: "Query workflow",
    });

    const trpc = createE2ETrpcClient(request);
    const result = await trpc.workflows.getMany.query({
      page: 1,
      pageSize: 5,
      search: "query",
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 5,
      totalCount: 1,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "e2e_workflow_query",
        name: "Query workflow",
      }),
    ]);
  });

  test("executes a real protected tRPC mutation over HTTP", async ({ request }) => {
    const user = buildE2EUser("trpc_mutation");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_mutation",
      userId: dbUser.id,
      name: "Old workflow name",
    });

    const trpc = createE2ETrpcClient(request);
    await expect(
      trpc.workflows.updateName.mutate({
        id: "e2e_workflow_mutation",
        name: "New workflow name",
      }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_mutation",
      name: "New workflow name",
    });

    await expect(getWorkflowById("e2e_workflow_mutation")).resolves.toMatchObject({
      name: "New workflow name",
    });
  });

  test("executes batched tRPC queries over one HTTP transport", async ({ request }) => {
    const user = buildE2EUser("trpc_batch");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_batch",
      userId: dbUser.id,
      name: "Batch workflow",
    });
    await seedE2ECredential({
      id: "e2e_credential_batch",
      userId: dbUser.id,
      name: "Batch OpenAI",
    });

    const trpc = createE2ETrpcClient(request);
    const [workflows, credentials] = await Promise.all([
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "batch" }),
      trpc.credentials.getByType.query({ type: "OPENAI" }),
    ]);

    expect(workflows.items).toEqual([
      expect.objectContaining({ id: "e2e_workflow_batch" }),
    ]);
    expect(credentials).toEqual([
      expect.objectContaining({
        id: "e2e_credential_batch",
        name: "Batch OpenAI",
      }),
    ]);
  });

  test("rejects invalid tRPC input through the real route", async ({ request }) => {
    const user = buildE2EUser("trpc_validation");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);

    await expectRejectsWithTrpcCode(
      trpc.workflows.getMany.query({ page: 1, pageSize: 101, search: "" }),
      "BAD_REQUEST",
    );
  });

  test("rejects unknown procedures safely", async ({ request }) => {
    const user = buildE2EUser("trpc_unknown");
    await signUpEmail(request, user);

    const response = await request.post("/api/trpc/does.not.exist", {
      data: JSON.stringify({ json: null }),
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expectNoSecretLeakInResponse(response);
  });

  test("rejects malformed JSON safely", async ({ request }) => {
    const user = buildE2EUser("trpc_malformed");
    await signUpEmail(request, user);

    const response = await postRawJson(request, "/api/trpc/workflows.getMany", "{");

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expectNoSecretLeakInResponse(response);
  });

  test("saves valid workflow graph input through real HTTP", async ({ request }) => {
    const user = buildE2EUser("trpc_graph");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_graph",
      userId: dbUser.id,
      name: "Graph workflow",
    });

    const trpc = createE2ETrpcClient(request);
    const graph = buildMinimalWorkflowGraph();

    await expect(
      trpc.workflows.update.mutate({
        id: "e2e_workflow_graph",
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    ).resolves.toMatchObject({
      id: "e2e_workflow_graph",
    });

    const workflow = await getWorkflowById("e2e_workflow_graph");
    expect(workflow.nodes.map((node) => node.id).sort()).toEqual([
      "e2e_node_initial",
      "e2e_node_openai",
    ]);
    expect(workflow.connections).toHaveLength(1);
  });
});
