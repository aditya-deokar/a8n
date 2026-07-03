import { expect, test } from "@playwright/test";
import { buildE2EUser } from "../fixtures/users";
import { newSignedUpE2ERequestContext, signUpEmail } from "../helpers/auth";
import {
  cleanupE2EData,
  countCredentialById,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getCredentialById,
  seedE2ECredential,
} from "../helpers/db";
import {
  expectNoSecretLeakInText,
  expectRejects,
  expectRejectsWithTrpcCode,
} from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

test.describe("backend E2E credential lifecycle", () => {
  test.beforeEach(async () => {
    await cleanupE2EData();
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("pro test user creates an encrypted credential through real HTTP", async ({ request }) => {
    const user = buildE2EUser("pro_credential_create");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);
    const rawSecret = "sk-test-e2e-create-secret";

    const credential = await trpc.credentials.create.mutate({
      name: "E2E OpenAI",
      type: "OPENAI",
      value: rawSecret,
    });

    expect(credential).toMatchObject({
      name: "E2E OpenAI",
      type: "OPENAI",
    });
    const persisted = await getCredentialById(credential.id);
    expect(persisted.value).not.toBe(rawSecret);
    expect(persisted.value).toEqual(expect.any(String));
    expect(JSON.stringify(credential)).not.toContain(rawSecret);
    expectNoSecretLeakInText(JSON.stringify(credential));
  });

  test("free test user cannot create a premium credential", async ({ request }) => {
    const user = buildE2EUser("free_credential_create");
    await signUpEmail(request, user);
    const trpc = createE2ETrpcClient(request);

    await expectRejectsWithTrpcCode(
      trpc.credentials.create.mutate({
        name: "Blocked credential",
        type: "OPENAI",
        value: "sk-test-e2e-blocked",
      }),
      "FORBIDDEN",
    );
  });

  test("lists and filters credential records without raw secret exposure", async ({ request }) => {
    const user = buildE2EUser("credential_list_filter");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2ECredential({
      id: "e2e_credential_list_filter",
      userId: dbUser.id,
      name: "Filtered OpenAI",
      rawValue: "sk-test-e2e-list-secret",
    });
    const trpc = createE2ETrpcClient(request);

    const list = await trpc.credentials.getMany.query({
      page: 1,
      pageSize: 5,
      search: "filtered",
    });
    const byType = await trpc.credentials.getByType.query({ type: "OPENAI" });

    expect(list.items).toEqual([
      expect.objectContaining({
        id: "e2e_credential_list_filter",
        name: "Filtered OpenAI",
      }),
    ]);
    expect(byType).toEqual([
      expect.objectContaining({
        id: "e2e_credential_list_filter",
        type: "OPENAI",
      }),
    ]);
    expect(JSON.stringify(list)).not.toContain("sk-test-e2e-list-secret");
    expect(JSON.stringify(byType)).not.toContain("sk-test-e2e-list-secret");
  });

  test("updates credential secret and changes encrypted persistence value", async ({ request }) => {
    const user = buildE2EUser("credential_update");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2ECredential({
      id: "e2e_credential_update",
      userId: dbUser.id,
      name: "Old Credential",
      rawValue: "sk-test-e2e-old-secret",
    });
    const before = await getCredentialById("e2e_credential_update");
    const trpc = createE2ETrpcClient(request);

    const updated = await trpc.credentials.update.mutate({
      id: "e2e_credential_update",
      name: "Updated Credential",
      type: "OPENAI",
      value: "sk-test-e2e-new-secret",
    });
    const after = await getCredentialById("e2e_credential_update");

    expect(updated).toMatchObject({
      id: "e2e_credential_update",
      name: "Updated Credential",
    });
    expect(after.value).not.toBe(before.value);
    expect(after.value).not.toBe("sk-test-e2e-new-secret");
    expect(JSON.stringify(updated)).not.toContain("sk-test-e2e-new-secret");
  });

  test("deletes a credential through real HTTP", async ({ request }) => {
    const user = buildE2EUser("credential_delete");
    await signUpEmail(request, user);
    const dbUser = await findE2EUserByEmail(user.email);
    await seedE2ECredential({
      id: "e2e_credential_delete",
      userId: dbUser.id,
      name: "Delete Credential",
    });
    const trpc = createE2ETrpcClient(request);

    await expect(
      trpc.credentials.remove.mutate({ id: "e2e_credential_delete" }),
    ).resolves.toMatchObject({
      id: "e2e_credential_delete",
    });

    await expect(countCredentialById("e2e_credential_delete")).resolves.toBe(0);
  });

  test("another user cannot read, update, or delete a credential", async () => {
    const owner = buildE2EUser("credential_owner");
    const attacker = buildE2EUser("credential_attacker");
    const ownerContext = await newSignedUpE2ERequestContext(owner);
    const attackerContext = await newSignedUpE2ERequestContext(attacker);

    try {
      const ownerRecord = await findE2EUserByEmail(owner.email);
      await seedE2ECredential({
        id: "e2e_credential_tenant_owned",
        userId: ownerRecord.id,
        name: "Tenant Owned Credential",
        rawValue: "sk-test-e2e-tenant-secret",
      });

      const attackerTrpc = createE2ETrpcClient(attackerContext);

      await expectRejects(
        attackerTrpc.credentials.getOne.query({ id: "e2e_credential_tenant_owned" }),
      );
      await expectRejects(
        attackerTrpc.credentials.update.mutate({
          id: "e2e_credential_tenant_owned",
          name: "Stolen",
          type: "OPENAI",
          value: "sk-test-e2e-stolen-secret",
        }),
      );
      await expectRejects(
        attackerTrpc.credentials.remove.mutate({ id: "e2e_credential_tenant_owned" }),
      );

      await expect(getCredentialById("e2e_credential_tenant_owned")).resolves.toMatchObject({
        name: "Tenant Owned Credential",
      });
    } finally {
      await ownerContext.dispose();
      await attackerContext.dispose();
    }
  });
});
