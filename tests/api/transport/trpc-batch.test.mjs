import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";
import { createHttpTrpcClient } from "../helpers/trpc-http-client.mjs";
import { resetApiTestMocks, setApiUser } from "../helpers/trpc-caller.mjs";

describe("/api/trpc batched transport", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("batches same-tick query calls through one HTTP request", async () => {
    const { client, requests } = await createHttpTrpcClient();

    const [workflows, credentials] = await Promise.all([
      client.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
      client.credentials.getByType.query({ type: "OPENAI" }),
    ]);

    expect(workflows.items).toHaveLength(1);
    expect(credentials).toHaveLength(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("batch=1");
    expect(requests[0].url).toContain("workflows.getMany");
    expect(requests[0].url).toContain("credentials.getByType");
  });

  it("keeps successful batched calls usable when another batched call fails validation", async () => {
    const { client } = await createHttpTrpcClient();

    const [validResult, invalidResult] = await Promise.allSettled([
      client.workflows.getMany.query({ page: 1, pageSize: 5, search: "" }),
      client.credentials.getByType.query({ type: "NOT_A_PROVIDER" }),
    ]);

    expect(validResult.status).toBe("fulfilled");
    expect(validResult.value.items).toHaveLength(1);
    expect(invalidResult.status).toBe("rejected");
    expect(invalidResult.reason).toMatchObject({
      data: expect.objectContaining({
        code: "BAD_REQUEST",
      }),
    });
    expect(prismaMock.workflow.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.credential.findMany).not.toHaveBeenCalled();
  });
});
