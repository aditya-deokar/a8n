import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildCredential } from "../fixtures/factories.mjs";
import {
  createAppCaller,
  resetApiTestMocks,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

describe("credentials router integration", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
  });

  it("creates encrypted credentials for the current premium user", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.credentials.create({
        name: "OpenAI",
        type: "OPENAI",
        value: "sk-raw-secret",
      }),
    ).resolves.toMatchObject({
      id: "credential_created",
      name: "OpenAI",
      type: "OPENAI",
      userId: apiUsers.userAPro.id,
    });

    const args = prismaMock.credential.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      name: "OpenAI",
      type: "OPENAI",
      userId: apiUsers.userAPro.id,
    });
    expect(args.data.value).not.toBe("sk-raw-secret");
  });

  it("updates and re-encrypts credential values", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.credentials.update({
        id: "credential_a",
        name: "Renamed OpenAI",
        type: "OPENAI",
        value: "sk-new-secret",
      }),
    ).resolves.toMatchObject({
      name: "Renamed OpenAI",
      type: "OPENAI",
    });

    const args = prismaMock.credential.update.mock.calls[0][0];
    expect(args.where).toEqual({
      id: "credential_a",
      userId: apiUsers.userAPro.id,
    });
    expect(args.data.value).not.toBe("sk-new-secret");
    expect(args.data.value).toEqual(expect.any(String));
  });

  it("lists only current-user credentials with search and pagination", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.credentials.getMany({ page: 2, pageSize: 5, search: "open" }),
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 5,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: true,
    });

    expect(prismaMock.credential.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          userId: apiUsers.userAPro.id,
          name: { contains: "open", mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("fetches one credential through the user ownership filter", async () => {
    prismaMock.credential.findUniqueOrThrow.mockResolvedValue(
      buildCredential({ id: "credential_one", value: "encrypted:value" }),
    );
    const caller = await createAppCaller();

    await expect(caller.credentials.getOne({ id: "credential_one" })).resolves.toMatchObject({
      id: "credential_one",
      value: "encrypted:value",
    });
    expect(prismaMock.credential.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "credential_one", userId: apiUsers.userAPro.id },
    });
  });

  it("filters credentials by provider type for the current user", async () => {
    const caller = await createAppCaller();

    await expect(caller.credentials.getByType({ type: "OPENAI" })).resolves.toHaveLength(1);
    expect(prismaMock.credential.findMany).toHaveBeenCalledWith({
      where: { type: "OPENAI", userId: apiUsers.userAPro.id },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("deletes only the current user's credential", async () => {
    const caller = await createAppCaller();

    await expect(caller.credentials.remove({ id: "credential_a" })).resolves.toMatchObject({
      id: "credential_a",
    });
    expect(prismaMock.credential.delete).toHaveBeenCalledWith({
      where: { id: "credential_a", userId: apiUsers.userAPro.id },
    });
  });
});
