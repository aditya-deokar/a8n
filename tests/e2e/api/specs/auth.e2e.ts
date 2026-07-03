import { expect, test } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { signInEmail, signOut, signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  disconnectE2EDatabase,
  findE2EUserByEmail,
} from "../helpers/db";
import {
  expectNoSecretLeakInResponse,
  expectRejectsWithTrpcCode,
} from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

test.describe("backend E2E auth and sessions", () => {
  test.beforeEach(async () => {
    await cleanupE2EData();
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("signs up a user and uses the session cookie for protected tRPC", async ({ request }) => {
    const user = buildE2EUser("signup_session");

    await signUpEmail(request, user);
    await expect(findE2EUserByEmail(user.email)).resolves.toMatchObject({
      email: user.email,
    });

    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 5,
      items: [],
    });
  });

  test("logs in with email/password and persists session cookies", async ({ request }) => {
    const user = buildE2EUser("login_session");

    await signUpEmail(request, user);
    await signOut(request);
    await signInEmail(request, user);

    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
    ).resolves.toMatchObject({
      items: [],
    });
  });

  test("rejects protected tRPC calls without a session", async ({ request }) => {
    const trpc = createE2ETrpcClient(request);

    await expectRejectsWithTrpcCode(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
      "UNAUTHORIZED",
    );
  });

  test("logout invalidates protected tRPC access", async ({ request }) => {
    const user = buildE2EUser("logout_session");
    await signUpEmail(request, user);

    const trpc = createE2ETrpcClient(request);
    await expect(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
    ).resolves.toMatchObject({ items: [] });

    await signOut(request);

    await expectRejectsWithTrpcCode(
      trpc.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
      "UNAUTHORIZED",
    );
  });

  test("invalid login returns a safe error response", async ({ request }) => {
    const response = await request.post("/api/auth/sign-in/email", {
      data: {
        email: "e2e_missing_user@example.com",
        password: "wrong-password",
        callbackURL: "/workflows",
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expectNoSecretLeakInResponse(response);
  });
});
