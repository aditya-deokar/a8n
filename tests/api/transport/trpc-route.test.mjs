import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildWorkflow } from "../fixtures/factories.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";
import {
  callTrpcRoute,
  createHttpTrpcClient,
} from "../helpers/trpc-http-client.mjs";
import {
  resetApiTestMocks,
  setAnonymousApiUser,
  setApiUser,
} from "../helpers/trpc-caller.mjs";

describe("/api/trpc transport", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("executes query procedures through the HTTP route", async () => {
    const { client } = await createHttpTrpcClient();

    await expect(
      client.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 5,
      totalCount: 1,
      items: [expect.objectContaining({ id: "workflow_a" })],
    });
    expect(prismaMock.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: apiUsers.userAPro.id,
        }),
      }),
    );
  });

  it("executes mutation procedures through the HTTP route", async () => {
    const { client } = await createHttpTrpcClient();

    await expect(
      client.workflows.updateName.mutate({
        id: "workflow_a",
        name: "Transport rename",
      }),
    ).resolves.toMatchObject({
      name: "Transport rename",
    });
    expect(prismaMock.workflow.update).toHaveBeenCalledWith({
      where: { id: "workflow_a", userId: apiUsers.userAPro.id },
      data: { name: "Transport rename" },
    });
  });

  it("preserves SuperJSON date values through the route", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([
      buildWorkflow({
        id: "workflow_date",
        updatedAt: new Date("2026-07-03T12:00:00.000Z"),
      }),
    ]);
    const { client } = await createHttpTrpcClient();

    const result = await client.workflows.getMany.query({
      page: 1,
      pageSize: 5,
      search: "",
    });

    expect(result.items[0].updatedAt).toBeInstanceOf(Date);
    expect(result.items[0].updatedAt.toISOString()).toBe("2026-07-03T12:00:00.000Z");
  });

  it("returns client-visible UNAUTHORIZED errors for missing sessions", async () => {
    setAnonymousApiUser();
    const { client } = await createHttpTrpcClient();

    await expect(
      client.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({
        code: "UNAUTHORIZED",
      }),
    });
  });

  it("returns an error response for malformed JSON bodies", async () => {
    const response = await callTrpcRoute({
      path: "workflows.getMany",
      method: "POST",
      body: "{",
    });
    const body = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body).not.toContain(process.env.DATABASE_URL);
    expect(body).not.toContain("ENCRYPTION_KEY");
  });

  it("returns an error response for unknown procedures", async () => {
    const response = await callTrpcRoute({
      path: "does.not.exist",
      method: "POST",
      body: JSON.stringify({ json: null }),
    });
    const body = await response.text();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body).toContain("does.not.exist");
  });
});
