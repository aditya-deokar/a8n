import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { apiProcedureCases } from "../helpers/procedure-cases.mjs";
import {
  createAppCaller,
  expectTrpcCode,
  resetApiTestMocks,
  setAnonymousApiUser,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

describe("internal API authorization negative paths", () => {
  beforeEach(() => {
    resetApiTestMocks();
  });

  it.each(apiProcedureCases)(
    "rejects anonymous access to $path",
    async ({ call }) => {
      setAnonymousApiUser();
      const caller = await createAppCaller();

      await expect(call(caller)).rejects.toSatisfy((error) => {
        expectTrpcCode(error, "UNAUTHORIZED");
        return true;
      });
    },
  );

  it.each(apiProcedureCases.filter((item) => item.access === "premium"))(
    "rejects free users for premium procedure $path",
    async ({ call }) => {
      setApiUser(apiUsers.userAFree);
      setPremiumSubscription(false);
      const caller = await createAppCaller();

      await expect(call(caller)).rejects.toSatisfy((error) => {
        expectTrpcCode(error, "FORBIDDEN");
        return true;
      });
    },
  );

  it("allows pro users through workflows.create and scopes persistence to their user id", async () => {
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
    const caller = await createAppCaller();

    await expect(caller.workflows.create()).resolves.toMatchObject({
      id: "workflow_created",
      userId: apiUsers.userAPro.id,
    });
    expect(prismaMock.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: apiUsers.userAPro.id,
        }),
      }),
    );
  });

  it("allows pro users through credentials.create and encrypts before persistence", async () => {
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
    const caller = await createAppCaller();

    await expect(
      caller.credentials.create({
        name: "OpenAI",
        type: "OPENAI",
        value: "sk-raw-secret",
      }),
    ).resolves.toMatchObject({
      id: "credential_created",
      userId: apiUsers.userAPro.id,
      type: "OPENAI",
    });

    const createArgs = prismaMock.credential.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe(apiUsers.userAPro.id);
    expect(createArgs.data.value).not.toBe("sk-raw-secret");
    expect(createArgs.data.value).toEqual(expect.any(String));
  });
});
