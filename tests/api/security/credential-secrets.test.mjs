import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildCredential } from "../fixtures/factories.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";
import {
  createAppCaller,
  resetApiTestMocks,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";

function serialized(value) {
  return JSON.stringify(value);
}

describe("credential secret regression coverage", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
  });

  it("never persists or returns raw credential values on create", async () => {
    const caller = await createAppCaller();
    const result = await caller.credentials.create({
      name: "OpenAI",
      type: "OPENAI",
      value: "sk-raw-create-secret",
    });
    const createArgs = prismaMock.credential.create.mock.calls[0][0];

    expect(createArgs.data.value).not.toBe("sk-raw-create-secret");
    expect(serialized(createArgs)).not.toContain("sk-raw-create-secret");
    expect(serialized(result)).not.toContain("sk-raw-create-secret");
  });

  it("never persists or returns raw credential values on update", async () => {
    const caller = await createAppCaller();
    const result = await caller.credentials.update({
      id: "credential_a",
      name: "OpenAI updated",
      type: "OPENAI",
      value: "sk-raw-update-secret",
    });
    const updateArgs = prismaMock.credential.update.mock.calls[0][0];

    expect(updateArgs.data.value).not.toBe("sk-raw-update-secret");
    expect(serialized(updateArgs)).not.toContain("sk-raw-update-secret");
    expect(serialized(result)).not.toContain("sk-raw-update-secret");
  });

  it("read procedures only expose stored encrypted credential values, never raw fixtures", async () => {
    prismaMock.credential.findMany.mockResolvedValue([
      buildCredential({ id: "credential_safe", value: "encrypted:credential-value" }),
    ]);
    const caller = await createAppCaller();

    const result = await caller.credentials.getMany({
      page: 1,
      pageSize: 5,
      search: "",
    });

    expect(result.items[0].value).toBe("encrypted:credential-value");
    expect(serialized(result)).not.toContain("sk-");
    expect(serialized(result)).not.toContain("raw");
  });
});
