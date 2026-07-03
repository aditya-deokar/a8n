import { expect, test, type APIRequestContext } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import {
  buildGoogleFormWorkflowGraph,
  buildStripeWorkflowGraph,
} from "../fixtures/workflow-graphs";
import { postRawJson } from "../helpers/api-client";
import { signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  seedE2EWorkflow,
} from "../helpers/db";
import {
  clearE2EWorkflowDispatches,
  listE2EWorkflowDispatches,
} from "../helpers/dispatches";
import {
  expectNoSecretLeakInResponse,
  expectNoSecretLeakInText,
} from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";
import {
  buildGoogleFormPayload,
  buildStripePayload,
  GOOGLE_FORM_WEBHOOK_SECRET,
  signStripePayload,
} from "../helpers/webhooks";

type WorkflowGraph = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
};

async function createWebhookWorkflow(params: {
  request: APIRequestContext;
  label: string;
  workflowId: string;
  graph: WorkflowGraph;
}) {
  const user = buildE2EUser(params.label);
  await signUpEmail(params.request, user);
  const dbUser = await findE2EUserByEmail(user.email);
  await seedE2EWorkflow({
    id: params.workflowId,
    userId: dbUser.id,
    name: params.workflowId,
  });

  const trpc = createE2ETrpcClient(params.request);
  await trpc.workflows.update.mutate({
    id: params.workflowId,
    nodes: params.graph.nodes,
    edges: params.graph.edges,
  });
}

test.describe("backend E2E public webhooks", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupE2EData();
    await clearE2EWorkflowDispatches(request);
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("rejects Google Form webhook without shared secret", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_google_missing_secret";
    await createWebhookWorkflow({
      request,
      label: "webhook_google_missing",
      workflowId,
      graph: buildGoogleFormWorkflowGraph(),
    });

    const response = await request.post(
      `/api/webhooks/google-form?workflowId=${workflowId}`,
      { data: buildGoogleFormPayload() },
    );

    expect(response.status()).toBe(401);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("rejects Google Form webhook with wrong shared secret", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_google_wrong_secret";
    await createWebhookWorkflow({
      request,
      label: "webhook_google_wrong",
      workflowId,
      graph: buildGoogleFormWorkflowGraph(),
    });

    const response = await request.post(
      `/api/webhooks/google-form?workflowId=${workflowId}`,
      {
        data: buildGoogleFormPayload(),
        headers: { "x-a8n-webhook-secret": "wrong-webhook-secret" },
      },
    );

    expect(response.status()).toBe(401);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("accepts valid Google Form webhook and records dispatch", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_google_valid";
    await createWebhookWorkflow({
      request,
      label: "webhook_google_valid",
      workflowId,
      graph: buildGoogleFormWorkflowGraph(),
    });

    const response = await request.post(
      `/api/webhooks/google-form?workflowId=${workflowId}`,
      {
        data: buildGoogleFormPayload(),
        headers: { "x-a8n-webhook-secret": GOOGLE_FORM_WEBHOOK_SECRET },
      },
    );

    expect(response.status()).toBe(200);
    await expectNoSecretLeakInResponse(response);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      inngestEventId: expect.any(String),
      webhookSecurity: {
        verified: true,
      },
    });

    const dispatches = await listE2EWorkflowDispatches(request, workflowId);
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      workflowId,
      data: {
        workflowId,
        initialData: {
          googleForm: {
            responseId: "e2e_response_123",
          },
        },
      },
    });
    expectNoSecretLeakInText(JSON.stringify(dispatches));
  });

  test("rejects malformed Google Form payload safely", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_google_malformed";
    await createWebhookWorkflow({
      request,
      label: "webhook_google_malformed",
      workflowId,
      graph: buildGoogleFormWorkflowGraph(),
    });

    const response = await postRawJson(
      request,
      `/api/webhooks/google-form?workflowId=${workflowId}`,
      "{",
      { "x-a8n-webhook-secret": GOOGLE_FORM_WEBHOOK_SECRET },
    );

    expect(response.status()).toBe(400);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("rejects Stripe webhook without signature", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_stripe_missing_signature";
    await createWebhookWorkflow({
      request,
      label: "webhook_stripe_missing",
      workflowId,
      graph: buildStripeWorkflowGraph(),
    });

    const response = await request.post(`/api/webhooks/stripe?workflowId=${workflowId}`, {
      data: JSON.stringify(buildStripePayload()),
      headers: { "content-type": "application/json" },
    });

    expect(response.status()).toBe(401);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("rejects Stripe webhook with wrong signature", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_stripe_wrong_signature";
    await createWebhookWorkflow({
      request,
      label: "webhook_stripe_wrong",
      workflowId,
      graph: buildStripeWorkflowGraph(),
    });
    const rawBody = JSON.stringify(buildStripePayload());
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await request.post(`/api/webhooks/stripe?workflowId=${workflowId}`, {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=not-a-valid-signature`,
      },
    });

    expect(response.status()).toBe(401);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("rejects Stripe webhook outside timestamp tolerance", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_stripe_old_signature";
    await createWebhookWorkflow({
      request,
      label: "webhook_stripe_old",
      workflowId,
      graph: buildStripeWorkflowGraph(),
    });
    const rawBody = JSON.stringify(buildStripePayload());
    const oldTimestamp = Math.floor(Date.now() / 1000) - 1_000;

    const response = await request.post(`/api/webhooks/stripe?workflowId=${workflowId}`, {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "stripe-signature": signStripePayload(rawBody, oldTimestamp),
      },
    });

    expect(response.status()).toBe(401);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });

  test("accepts valid Stripe signature and records dispatch", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_stripe_valid";
    await createWebhookWorkflow({
      request,
      label: "webhook_stripe_valid",
      workflowId,
      graph: buildStripeWorkflowGraph(),
    });
    const rawBody = JSON.stringify(buildStripePayload());

    const response = await request.post(`/api/webhooks/stripe?workflowId=${workflowId}`, {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "stripe-signature": signStripePayload(rawBody),
      },
    });

    expect(response.status()).toBe(200);
    await expectNoSecretLeakInResponse(response);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      inngestEventId: expect.any(String),
      webhookSecurity: {
        verified: true,
        mode: "stripe-signature",
      },
    });

    const dispatches = await listE2EWorkflowDispatches(request, workflowId);
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0]).toMatchObject({
      workflowId,
      data: {
        workflowId,
        initialData: {
          stripe: {
            eventId: "evt_e2e_stripe_123",
            eventType: "payment_intent.succeeded",
          },
        },
      },
    });
    expectNoSecretLeakInText(JSON.stringify(dispatches));
  });

  test("rejects signed malformed Stripe payload safely", async ({ request }) => {
    const workflowId = "e2e_workflow_webhook_stripe_malformed";
    await createWebhookWorkflow({
      request,
      label: "webhook_stripe_malformed",
      workflowId,
      graph: buildStripeWorkflowGraph(),
    });
    const rawBody = "{";

    const response = await postRawJson(
      request,
      `/api/webhooks/stripe?workflowId=${workflowId}`,
      rawBody,
      { "stripe-signature": signStripePayload(rawBody) },
    );

    expect(response.status()).toBe(400);
    await expectNoSecretLeakInResponse(response);
    await expect(listE2EWorkflowDispatches(request, workflowId)).resolves.toEqual([]);
  });
});
