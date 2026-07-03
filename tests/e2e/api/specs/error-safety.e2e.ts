import { expect, test, type APIResponse } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { postRawJson, postTrpcJson } from "../helpers/api-client";
import { signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getWorkflowById,
  seedE2EWorkflow,
} from "../helpers/db";
import {
  clearE2EWorkflowDispatches,
  listE2EWorkflowDispatches,
} from "../helpers/dispatches";
import { clearE2EFaults, setE2EFault } from "../helpers/faults";
import { expectNoSecretLeakInText } from "../helpers/assertions";

async function expectSafeFailure(
  response: APIResponse,
  rawValues: string[] = [],
) {
  expect(response.status()).toBeGreaterThanOrEqual(400);
  const text = await response.text();

  expectNoSecretLeakInText(text);
  expect(text).not.toContain("DATABASE_URL");
  expect(text).not.toContain("ENCRYPTION_KEY");
  expect(text).not.toContain("BETTER_AUTH_SECRET");
  expect(text).not.toContain("POLAR_ACCESS_TOKEN");
  expect(text).not.toContain("MCP_API_KEY_HMAC_SECRET");
  expect(text).not.toContain("MCP_OAUTH_TOKEN_HMAC_SECRET");
  expect(text).not.toContain("keyHash");
  expect(text).not.toContain("tokenHash");

  for (const rawValue of rawValues) {
    expect(text).not.toContain(rawValue);
  }
}

test.describe("backend E2E error safety and abuse handling", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupE2EData();
    await clearE2EWorkflowDispatches(request);
    await clearE2EFaults(request);
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("rejects malformed JSON and unknown tRPC procedures safely", async ({ request }) => {
    const user = buildE2EUser("error_malformed_unknown");
    await signUpEmail(request, user);

    await expectSafeFailure(
      await postRawJson(request, "/api/trpc/workflows.getMany", "{"),
    );
    await expectSafeFailure(
      await postTrpcJson(request, "does.not.exist", null),
    );
  });

  test("rejects large bad tRPC requests without leaking payload data", async ({ request }) => {
    const user = buildE2EUser("error_large_request");
    await signUpEmail(request, user);
    const rawPayloadMarker = "e2e-large-request-secret-marker";
    const body = JSON.stringify({
      json: {
        payload: `${rawPayloadMarker}:${"x".repeat(256_000)}`,
      },
    });

    const response = await postRawJson(request, "/api/trpc/does.not.exist", body);

    await expectSafeFailure(response, [rawPayloadMarker]);
  });

  test("rejects invalid enum input without echoing raw credential values", async ({ request }) => {
    const user = buildE2EUser("pro_error_invalid_enum");
    await signUpEmail(request, user);
    const rawCredentialValue = "raw-credential-error-value";

    const response = await postTrpcJson(request, "credentials.create", {
      name: "Invalid enum credential",
      type: "NOT_A_PROVIDER",
      value: rawCredentialValue,
    });

    await expectSafeFailure(response, [rawCredentialValue]);
  });

  test("rejects invalid graph references and keeps the previous graph intact", async ({ request }) => {
    const user = buildE2EUser("error_invalid_graph_refs");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_error_invalid_graph_refs",
      userId: dbUser.id,
      name: "Invalid Graph References",
    });
    const before = await getWorkflowById("e2e_workflow_error_invalid_graph_refs");

    const response = await postTrpcJson(request, "workflows.update", {
      id: "e2e_workflow_error_invalid_graph_refs",
      nodes: [
        {
          id: "e2e_error_node_initial",
          type: "INITIAL",
          position: { x: 0, y: 0 },
          data: {},
        },
      ],
      edges: [
        {
          source: "e2e_error_node_initial",
          target: "e2e_missing_target",
          sourceHandle: null,
          targetHandle: null,
        },
      ],
    });

    await expectSafeFailure(response);
    const after = await getWorkflowById("e2e_workflow_error_invalid_graph_refs");
    expect(after.nodes.map((node) => node.id).sort()).toEqual(
      before.nodes.map((node) => node.id).sort(),
    );
    expect(after.connections).toHaveLength(before.connections.length);
  });

  test("simulated Prisma failures are safe at the HTTP layer", async ({ request }) => {
    const user = buildE2EUser("error_prisma_fault");
    await signUpEmail(request, user);
    await setE2EFault(request, "prisma");

    const response = await postTrpcJson(request, "executions.getMany", {
      page: 1,
      pageSize: 5,
    });

    await expectSafeFailure(response);
  });

  test("simulated Inngest failures do not create dispatch records", async ({ request }) => {
    const user = buildE2EUser("error_inngest_fault");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2EWorkflow({
      id: "e2e_workflow_error_inngest_fault",
      userId: dbUser.id,
      name: "Inngest Fault",
    });
    await setE2EFault(request, "inngest");

    const response = await postTrpcJson(request, "workflows.execute", {
      id: "e2e_workflow_error_inngest_fault",
    });

    await expectSafeFailure(response);
    await expect(
      listE2EWorkflowDispatches(request, "e2e_workflow_error_inngest_fault"),
    ).resolves.toEqual([]);
  });

  test("simulated Polar failures are safe at the HTTP layer", async ({ request }) => {
    const user = buildE2EUser("pro_error_polar_fault");
    await signUpEmail(request, user);
    await setE2EFault(request, "polar");

    const response = await postTrpcJson(request, "workflows.create", null);

    await expectSafeFailure(response);
  });
});
