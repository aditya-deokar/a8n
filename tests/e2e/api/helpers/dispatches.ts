import { expect, type APIRequestContext } from "@playwright/test";
import { expectNoSecretLeakInResponse } from "./assertions";

export type E2EWorkflowDispatch = {
  eventId: string;
  workflowId: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export async function clearE2EWorkflowDispatches(request: APIRequestContext) {
  const response = await request.delete("/api/e2e/workflow-dispatches");
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
}

export async function listE2EWorkflowDispatches(
  request: APIRequestContext,
  workflowId?: string,
) {
  const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : "";
  const response = await request.get(`/api/e2e/workflow-dispatches${query}`);
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);

  const body = (await response.json()) as {
    success: boolean;
    dispatches: E2EWorkflowDispatch[];
  };

  expect(body.success).toBe(true);
  return body.dispatches;
}
