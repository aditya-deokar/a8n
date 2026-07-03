import { expect, type APIResponse } from "@playwright/test";
import { findSecretLeak } from "./secrets";

export async function expectNoSecretLeakInResponse(response: APIResponse) {
  const body = await response.text();
  const leak = findSecretLeak(body);
  expect(leak, `Response leaked sensitive pattern ${leak?.toString()}`).toBeUndefined();
}

export function expectNoSecretLeakInText(text: string) {
  const leak = findSecretLeak(text);
  expect(leak, `Text leaked sensitive pattern ${leak?.toString()}`).toBeUndefined();
}

export function expectTrpcErrorCode(error: unknown, code: string) {
  expect(error).toMatchObject({
    data: expect.objectContaining({
      code,
    }),
  });
}

export async function expectRejectsWithTrpcCode(
  promise: Promise<unknown>,
  code: string,
) {
  try {
    await promise;
  } catch (error) {
    expectTrpcErrorCode(error, code);
    return;
  }

  throw new Error(`Expected tRPC promise to reject with ${code}.`);
}

export async function expectRejects(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    return;
  }

  throw new Error("Expected promise to reject.");
}
