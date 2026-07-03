import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { buildExecution } from "../fixtures/factories.mjs";
import {
  createAppCaller,
  resetApiTestMocks,
  setApiUser,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

describe("executions router integration", () => {
  beforeEach(() => {
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  it("lists current-user executions through workflow ownership", async () => {
    const caller = await createAppCaller();

    await expect(caller.executions.getMany({ page: 2, pageSize: 5 })).resolves.toMatchObject({
      page: 2,
      pageSize: 5,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: true,
    });

    expect(prismaMock.execution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          workflow: {
            userId: apiUsers.userAPro.id,
          },
        },
        orderBy: { startedAt: "desc" },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    );
  });

  it("fetches one execution through workflow ownership and includes workflow summary", async () => {
    prismaMock.execution.findUniqueOrThrow.mockResolvedValue(
      buildExecution({
        id: "execution_failed",
        status: "FAILED",
        error: "Provider failed",
        errorStack: "stack",
      }),
    );
    const caller = await createAppCaller();

    await expect(caller.executions.getOne({ id: "execution_failed" })).resolves.toMatchObject({
      id: "execution_failed",
      status: "FAILED",
      workflow: {
        id: "workflow_a",
        name: "Primary workflow",
      },
    });

    expect(prismaMock.execution.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "execution_failed",
        workflow: {
          userId: apiUsers.userAPro.id,
        },
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
});
