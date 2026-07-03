import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  apiDatabaseTestsEnabled,
  assertSafeTestDatabaseUrl,
} from "../helpers/db.mjs";

const describeDb = apiDatabaseTestsEnabled() ? describe : describe.skip;

const userIds = ["api_db_user_a", "api_db_user_b"];
const oauthClientId = "api_db_client";

let prisma;

async function cleanup() {
  if (!prisma) return;

  await prisma.user.deleteMany({
    where: {
      id: { in: userIds },
    },
  });
  await prisma.mcpOAuthClient.deleteMany({
    where: {
      clientId: oauthClientId,
    },
  });
}

async function seedUser(id = "api_db_user_a") {
  return prisma.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
    },
  });
}

async function seedWorkflow(userId = "api_db_user_a", workflowId = "api_db_workflow_a") {
  return prisma.workflow.create({
    data: {
      id: workflowId,
      name: "Database integrity workflow",
      userId,
      nodes: {
        create: [
          {
            id: `${workflowId}_node_a`,
            name: "INITIAL",
            type: "INITIAL",
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: `${workflowId}_node_b`,
            name: "OPENAI",
            type: "OPENAI",
            position: { x: 100, y: 0 },
            data: {},
          },
        ],
      },
    },
    include: {
      nodes: true,
    },
  });
}

describeDb("API database integrity", () => {
  beforeAll(async () => {
    assertSafeTestDatabaseUrl();
    prisma = (await import("@/lib/db")).default;
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect?.();
  });

  it("cascades workflow deletion to nodes, connections, and executions", async () => {
    await seedUser();
    const workflow = await seedWorkflow();
    const [fromNode, toNode] = workflow.nodes;

    await prisma.connection.create({
      data: {
        id: "api_db_connection_a",
        workflowId: workflow.id,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        fromOutput: "main",
        toInput: "main",
      },
    });
    await prisma.execution.create({
      data: {
        id: "api_db_execution_a",
        workflowId: workflow.id,
        status: "SUCCESS",
        inngestEventId: "api_db_event_a",
      },
    });

    await prisma.workflow.delete({ where: { id: workflow.id } });

    await expect(
      prisma.node.count({ where: { workflowId: workflow.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.connection.count({ where: { workflowId: workflow.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.execution.count({ where: { workflowId: workflow.id } }),
    ).resolves.toBe(0);
  });

  it("enforces unique workflow connections", async () => {
    await seedUser();
    const workflow = await seedWorkflow();
    const [fromNode, toNode] = workflow.nodes;
    const data = {
      workflowId: workflow.id,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      fromOutput: "main",
      toInput: "main",
    };

    await prisma.connection.create({ data: { id: "api_db_connection_a", ...data } });

    await expect(
      prisma.connection.create({ data: { id: "api_db_connection_b", ...data } }),
    ).rejects.toThrow();
    await expect(
      prisma.connection.count({ where: { workflowId: workflow.id } }),
    ).resolves.toBe(1);
  });

  it("enforces unique execution event ids", async () => {
    await seedUser();
    const workflow = await seedWorkflow();

    await prisma.execution.create({
      data: {
        id: "api_db_execution_a",
        workflowId: workflow.id,
        status: "SUCCESS",
        inngestEventId: "api_db_unique_event",
      },
    });

    await expect(
      prisma.execution.create({
        data: {
          id: "api_db_execution_b",
          workflowId: workflow.id,
          status: "SUCCESS",
          inngestEventId: "api_db_unique_event",
        },
      }),
    ).rejects.toThrow();
  });

  it("cascades user deletion to app, key, and OAuth records", async () => {
    const user = await seedUser();
    const workflow = await seedWorkflow(user.id, "api_db_workflow_user_delete");

    await prisma.session.create({
      data: {
        id: "api_db_session_a",
        token: "api_db_session_token_a",
        userId: user.id,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    await prisma.credential.create({
      data: {
        id: "api_db_credential_a",
        name: "OpenAI",
        value: "encrypted:value",
        type: "OPENAI",
        userId: user.id,
      },
    });
    await prisma.apiKey.create({
      data: {
        id: "api_db_key_a",
        name: "API key",
        keyHash: "api_db_key_hash_a",
        keyPrefix: "a8n_mcp_api_db",
        scopes: ["workflows:read"],
        userId: user.id,
      },
    });
    await prisma.mcpOAuthClient.create({
      data: {
        id: "api_db_oauth_client_pk",
        clientId: oauthClientId,
        clientName: "API DB Client",
        redirectUris: ["http://127.0.0.1:3000/callback"],
      },
    });
    await prisma.mcpOAuthConsent.create({
      data: {
        id: "api_db_consent_a",
        userId: user.id,
        clientId: oauthClientId,
        scopes: ["workflows:read"],
        redirectUri: "http://127.0.0.1:3000/callback",
        resource: "http://127.0.0.1:3000",
      },
    });
    await prisma.mcpOAuthAuthorizationCode.create({
      data: {
        id: "api_db_auth_code_a",
        codeHash: "api_db_auth_code_hash_a",
        userId: user.id,
        clientId: oauthClientId,
        redirectUri: "http://127.0.0.1:3000/callback",
        resource: "http://127.0.0.1:3000",
        scopes: ["workflows:read"],
        codeChallenge: "api_db_challenge",
        codeChallengeMethod: "S256",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    await prisma.mcpOAuthAccessToken.create({
      data: {
        id: "api_db_access_token_a",
        tokenHash: "api_db_access_hash_a",
        userId: user.id,
        clientId: oauthClientId,
        resource: "http://127.0.0.1:3000",
        scopes: ["workflows:read"],
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    await prisma.mcpOAuthRefreshToken.create({
      data: {
        id: "api_db_refresh_token_a",
        tokenHash: "api_db_refresh_hash_a",
        userId: user.id,
        clientId: oauthClientId,
        resource: "http://127.0.0.1:3000",
        scopes: ["workflows:read"],
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    await expect(prisma.workflow.count({ where: { id: workflow.id } })).resolves.toBe(0);
    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.credential.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.apiKey.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(
      prisma.mcpOAuthConsent.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.mcpOAuthAuthorizationCode.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.mcpOAuthAccessToken.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.mcpOAuthRefreshToken.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });
});
