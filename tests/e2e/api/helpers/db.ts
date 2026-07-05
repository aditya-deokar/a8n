import prisma from "../../../../src/lib/db";
import {
  CredentialType,
  ExecutionStatus,
  NodeType,
} from "../../../../src/generated/prisma";
import type { Prisma } from "../../../../src/generated/prisma";
import { encrypt } from "../../../../src/lib/encryption";

const E2E_PREFIX = "e2e_";

function assertE2EIdentifier(value: string) {
  if (!value.startsWith(E2E_PREFIX)) {
    throw new Error(`Refusing to operate on non-E2E identifier "${value}".`);
  }
}

function assertE2EOwner(owner: { id: string; email: string }, resourceId: string) {
  if (!owner.id.startsWith(E2E_PREFIX) && !owner.email.startsWith(E2E_PREFIX)) {
    throw new Error(
      `Refusing to operate on generated resource "${resourceId}" owned by non-E2E user "${owner.email}".`,
    );
  }
}

export async function cleanupE2EData() {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { startsWith: E2E_PREFIX } },
        { email: { startsWith: E2E_PREFIX } },
      ],
    },
  });
  await prisma.mcpOAuthClient.deleteMany({
    where: {
      OR: [
        { id: { startsWith: E2E_PREFIX } },
        { clientId: { startsWith: E2E_PREFIX } },
      ],
    },
  });
}

export async function findE2EUserByEmail(email: string) {
  if (!email.startsWith(E2E_PREFIX)) {
    throw new Error(`Refusing to look up non-E2E email "${email}".`);
  }

  return prisma.user.findUniqueOrThrow({
    where: { email },
  });
}

export async function seedE2EWorkflow(params: {
  id: string;
  userId: string;
  name?: string;
}) {
  assertE2EIdentifier(params.id);

  return prisma.workflow.create({
    data: {
      id: params.id,
      name: params.name ?? "E2E Workflow",
      userId: params.userId,
      nodes: {
        create: {
          id: `${params.id}_node_initial`,
          name: NodeType.INITIAL,
          type: NodeType.INITIAL,
          position: { x: 0, y: 0 },
          data: {},
        },
      },
    },
  });
}

export async function seedE2ECredential(params: {
  id: string;
  userId: string;
  name?: string;
  rawValue?: string;
  type?: CredentialType;
}) {
  assertE2EIdentifier(params.id);

  return prisma.credential.create({
    data: {
      id: params.id,
      name: params.name ?? "E2E OpenAI Credential",
      userId: params.userId,
      type: params.type ?? CredentialType.OPENAI,
      value: encrypt(params.rawValue ?? "sk-test-e2e-credential"),
    },
  });
}

export async function seedE2EExecution(params: {
  id: string;
  workflowId: string;
  status?: ExecutionStatus;
  error?: string | null;
  errorStack?: string | null;
  output?: Prisma.InputJsonValue;
  startedAt?: Date;
  completedAt?: Date | null;
  inngestEventId?: string;
}) {
  assertE2EIdentifier(params.id);
  assertE2EIdentifier(params.workflowId);

  return prisma.execution.create({
    data: {
      id: params.id,
      workflowId: params.workflowId,
      status: params.status ?? ExecutionStatus.SUCCESS,
      error: params.error ?? null,
      errorStack: params.errorStack ?? null,
      output: params.output,
      startedAt: params.startedAt ?? new Date("2026-07-03T12:00:00.000Z"),
      completedAt:
        params.completedAt === undefined
          ? new Date("2026-07-03T12:00:02.000Z")
          : params.completedAt,
      inngestEventId: params.inngestEventId ?? `${params.id}_event`,
    },
  });
}

export async function getWorkflowById(id: string) {
  assertE2EIdentifier(id);
  return prisma.workflow.findUniqueOrThrow({
    where: { id },
    include: { nodes: true, connections: true },
  });
}

export async function getCredentialById(id: string) {
  const credential = await prisma.credential.findUniqueOrThrow({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!id.startsWith(E2E_PREFIX)) {
    assertE2EOwner(credential.user, id);
  }

  return credential;
}

export async function getExecutionById(id: string) {
  assertE2EIdentifier(id);
  return prisma.execution.findUniqueOrThrow({
    where: { id },
  });
}

export async function getApiKeyById(id: string) {
  return prisma.apiKey.findUniqueOrThrow({
    where: { id },
  });
}

export async function seedE2EMcpOAuthConnection(params: {
  clientId: string;
  userId: string;
  clientName?: string;
  scopes?: string[];
  redirectUri?: string;
  resource?: string;
}) {
  assertE2EIdentifier(params.clientId);

  const scopes = params.scopes ?? ["workflows:read", "executions:read"];
  const redirectUri =
    params.redirectUri ?? "http://127.0.0.1:3000/api/oauth/callback/e2e";
  const resource = params.resource ?? "http://127.0.0.1:3000/api/mcp";
  const now = new Date("2026-07-03T12:00:00.000Z");
  const expiresAt = new Date("2099-07-03T12:00:00.000Z");

  await prisma.mcpOAuthClient.create({
    data: {
      id: `${params.clientId}_record`,
      clientId: params.clientId,
      clientName: params.clientName ?? "E2E OAuth Client",
      redirectUris: [redirectUri],
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
      scope: scopes.join(" "),
    },
  });

  await prisma.mcpOAuthConsent.create({
    data: {
      id: `${params.clientId}_consent`,
      userId: params.userId,
      clientId: params.clientId,
      scopes,
      redirectUri,
      resource,
      createdAt: now,
    },
  });

  await prisma.mcpOAuthAccessToken.create({
    data: {
      id: `${params.clientId}_access_token`,
      tokenHash: `${params.clientId}_access_hash`,
      userId: params.userId,
      clientId: params.clientId,
      resource,
      scopes,
      expiresAt,
      lastUsedAt: now,
    },
  });

  await prisma.mcpOAuthRefreshToken.create({
    data: {
      id: `${params.clientId}_refresh_token`,
      tokenHash: `${params.clientId}_refresh_hash`,
      userId: params.userId,
      clientId: params.clientId,
      resource,
      scopes,
      expiresAt,
      lastUsedAt: now,
    },
  });
}

export async function getE2EMcpOAuthTokenState(clientId: string) {
  assertE2EIdentifier(clientId);

  const [activeAccessTokens, activeRefreshTokens, activeConsents] =
    await Promise.all([
      prisma.mcpOAuthAccessToken.count({
        where: { clientId, revokedAt: null },
      }),
      prisma.mcpOAuthRefreshToken.count({
        where: { clientId, revokedAt: null },
      }),
      prisma.mcpOAuthConsent.count({
        where: { clientId, revokedAt: null },
      }),
    ]);

  return {
    activeAccessTokens,
    activeRefreshTokens,
    activeConsents,
  };
}

export async function countWorkflowById(id: string) {
  assertE2EIdentifier(id);
  return prisma.workflow.count({
    where: { id },
  });
}

export async function countCredentialById(id: string) {
  assertE2EIdentifier(id);
  return prisma.credential.count({
    where: { id },
  });
}

export async function disconnectE2EDatabase() {
  await prisma.$disconnect();
}
