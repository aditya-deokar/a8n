import { expect, type APIRequestContext } from "@playwright/test";
import { expectNoSecretLeakInResponse } from "./assertions";

export type E2EFaultName = "prisma" | "inngest" | "polar";

export async function setE2EFault(
  request: APIRequestContext,
  fault: E2EFaultName,
) {
  const response = await request.post("/api/e2e/faults", {
    data: { fault },
  });
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
}

export async function clearE2EFaults(request: APIRequestContext) {
  const response = await request.delete("/api/e2e/faults");
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
}
