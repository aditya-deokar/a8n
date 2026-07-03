import { vi } from "vitest";
import {
  buildApiKey,
  buildCredential,
  buildExecution,
  buildWorkflow,
} from "../fixtures/factories.mjs";

export const prismaMock = {
  workflow: {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  node: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  connection: {
    createMany: vi.fn(),
  },
  credential: {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  execution: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  apiKey: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  mcpOAuthConsent: {
    findMany: vi.fn(),
  },
  mcpOAuthAccessToken: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  mcpOAuthRefreshToken: {
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

function resetFn(fn) {
  fn.mockReset();
}

export function resetPrismaMock() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") {
      resetFn(model);
      continue;
    }

    for (const value of Object.values(model)) {
      if (typeof value?.mockReset === "function") {
        resetFn(value);
      }
    }
  }

  prismaMock.workflow.create.mockImplementation(async ({ data }) =>
    buildWorkflow({
      id: "workflow_created",
      name: data.name,
      userId: data.userId,
      nodes: [
        {
          id: "node_created",
          workflowId: "workflow_created",
          name: data.nodes?.create?.name ?? "INITIAL",
          type: data.nodes?.create?.type ?? "INITIAL",
          position: data.nodes?.create?.position ?? { x: 0, y: 0 },
          data: {},
        },
      ],
    }),
  );
  prismaMock.workflow.delete.mockResolvedValue(buildWorkflow());
  prismaMock.workflow.update.mockImplementation(async ({ data }) =>
    buildWorkflow({ name: data?.name ?? "Primary workflow" }),
  );
  prismaMock.workflow.findUniqueOrThrow.mockResolvedValue(buildWorkflow());
  prismaMock.workflow.findMany.mockResolvedValue([buildWorkflow()]);
  prismaMock.workflow.count.mockResolvedValue(1);

  prismaMock.node.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.node.createMany.mockResolvedValue({ count: 1 });
  prismaMock.connection.createMany.mockResolvedValue({ count: 0 });

  prismaMock.credential.create.mockImplementation(async ({ data }) =>
    buildCredential({
      id: "credential_created",
      name: data.name,
      type: data.type,
      value: data.value,
      userId: data.userId,
    }),
  );
  prismaMock.credential.delete.mockResolvedValue(buildCredential());
  prismaMock.credential.update.mockImplementation(async ({ data }) =>
    buildCredential({
      name: data.name,
      type: data.type,
      value: data.value,
    }),
  );
  prismaMock.credential.findUniqueOrThrow.mockResolvedValue(buildCredential());
  prismaMock.credential.findMany.mockResolvedValue([buildCredential()]);
  prismaMock.credential.count.mockResolvedValue(1);

  prismaMock.execution.findUniqueOrThrow.mockResolvedValue(buildExecution());
  prismaMock.execution.findMany.mockResolvedValue([buildExecution()]);
  prismaMock.execution.count.mockResolvedValue(1);

  prismaMock.apiKey.create.mockResolvedValue(buildApiKey());
  prismaMock.apiKey.findMany.mockResolvedValue([buildApiKey()]);
  prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 });

  prismaMock.mcpOAuthConsent.findMany.mockResolvedValue([]);
  prismaMock.mcpOAuthAccessToken.count.mockResolvedValue(0);
  prismaMock.mcpOAuthAccessToken.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.mcpOAuthRefreshToken.count.mockResolvedValue(0);
  prismaMock.mcpOAuthRefreshToken.updateMany.mockResolvedValue({ count: 0 });

  prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
}
