import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import type { E2EUserFixture } from "../fixtures/users";
import { expectNoSecretLeakInResponse } from "./assertions";

function baseURL() {
  return process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
}

export async function newE2ERequestContext() {
  return playwrightRequest.newContext({
    baseURL: baseURL(),
  });
}

export async function signUpEmail(request: APIRequestContext, user: E2EUserFixture) {
  const response = await request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
      callbackURL: "/workflows",
    },
  });
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
  return response;
}

export async function signInEmail(request: APIRequestContext, user: E2EUserFixture) {
  const response = await request.post("/api/auth/sign-in/email", {
    data: {
      email: user.email,
      password: user.password,
      callbackURL: "/workflows",
    },
  });
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
  return response;
}

export async function signOut(request: APIRequestContext) {
  const response = await request.post("/api/auth/sign-out", {
    data: {},
    headers: {
      Origin: baseURL(),
    },
  });
  await expectNoSecretLeakInResponse(response);
  expect(response.ok(), await response.text()).toBe(true);
  return response;
}

export async function newSignedUpE2ERequestContext(user: E2EUserFixture) {
  const context = await newE2ERequestContext();
  await signUpEmail(context, user);
  return context;
}
