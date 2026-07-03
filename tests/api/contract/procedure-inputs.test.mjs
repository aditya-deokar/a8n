import { beforeEach, describe, expect, it } from "vitest";
import {
  createAppCaller,
  expectTrpcCode,
  resetApiTestMocks,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

describe("internal API procedure input contracts", () => {
  beforeEach(() => {
    resetApiTestMocks();
  });

  it("rejects an empty workflow name before persistence", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.updateName({ id: "workflow_a", name: "" }),
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.workflow.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid workflow page size before persistence", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.getMany({ page: 1, pageSize: 101, search: "" }),
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.workflow.findMany).not.toHaveBeenCalled();
  });

  it("rejects malformed workflow graph updates before transaction work", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.workflows.update({
        id: "workflow_a",
        nodes: [{ id: "node_a", type: "INITIAL", position: { x: 0 } }],
        edges: [],
      }),
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid credential types before encryption or persistence", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.credentials.create({
        name: "Bad credential",
        type: "NOT_A_PROVIDER",
        value: "secret",
      }),
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.credential.create).not.toHaveBeenCalled();
  });

  it("rejects empty credential values before persistence", async () => {
    const caller = await createAppCaller();

    await expect(
      caller.credentials.update({
        id: "credential_a",
        name: "OpenAI",
        type: "OPENAI",
        value: "",
      }),
    ).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "BAD_REQUEST");
      return true;
    });
    expect(prismaMock.credential.update).not.toHaveBeenCalled();
  });

  it("rejects invalid execution pagination before persistence", async () => {
    const caller = await createAppCaller();

    await expect(caller.executions.getMany({ page: 1, pageSize: 0 })).rejects.toSatisfy(
      (error) => {
        expectTrpcCode(error, "BAD_REQUEST");
        return true;
      },
    );
    expect(prismaMock.execution.findMany).not.toHaveBeenCalled();
  });

  it("rejects empty OAuth client revocation input before service calls", async () => {
    const caller = await createAppCaller();

    await expect(caller.mcp.revokeOAuthConnection({ clientId: "" })).rejects.toSatisfy(
      (error) => {
        expectTrpcCode(error, "BAD_REQUEST");
        return true;
      },
    );
  });
});
