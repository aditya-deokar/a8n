import { OpenAIEmbeddings } from "@langchain/openai";
import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";
import { env } from "@/env";
import { AGENT_CONFIG } from "@/agent/config";
import { AgentError } from "@/agent/errors";

export type AgentMemoryNamespace = string[];

export type AgentMemoryItem = {
  id: string;
  namespace: AgentMemoryNamespace;
  content: string;
  data: Record<string, unknown>;
  score?: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryRow = {
  id: string;
  namespace: string[];
  content: string;
  data: unknown;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  score?: number;
};

let embeddings: OpenAIEmbeddings | undefined;

function getEmbeddings(): OpenAIEmbeddings {
  if (!env.OPENAI_API_KEY) {
    throw new AgentError(
      "AGENT_MEMORY_UNAVAILABLE",
      "Long-term memory requires an embedding provider configuration.",
    );
  }

  embeddings ??= new OpenAIEmbeddings({
    apiKey: env.OPENAI_API_KEY,
    model: AGENT_CONFIG.embeddingModel,
    dimensions: AGENT_CONFIG.embeddingDimensions,
  });
  return embeddings;
}

function vectorLiteral(vector: number[]): string {
  if (
    vector.length !== AGENT_CONFIG.embeddingDimensions ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new AgentError(
      "AGENT_MEMORY_UNAVAILABLE",
      "Embedding provider returned an incompatible vector.",
    );
  }

  return `[${vector.join(",")}]`;
}

function namespaceSql(namespace: AgentMemoryNamespace) {
  return Prisma.sql`ARRAY[${Prisma.join(namespace)}]::text[]`;
}

function mapRow(row: MemoryRow): AgentMemoryItem {
  return {
    id: row.id,
    namespace: row.namespace,
    content: row.content,
    data:
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {},
    score: row.score,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class AgentMemoryStore {
  async search(params: {
    userId: string;
    namespace: AgentMemoryNamespace;
    query: string;
    limit?: number;
  }): Promise<AgentMemoryItem[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 5, 20));
    const embedding = await getEmbeddings().embedQuery(params.query);
    const vector = vectorLiteral(embedding);
    const namespace = namespaceSql(params.namespace);

    const rows = await prisma.$queryRaw<MemoryRow[]>(Prisma.sql`
      SELECT
        "id",
        "namespace",
        "content",
        "data",
        "expiresAt",
        "createdAt",
        "updatedAt",
        1 - ("embedding" <=> ${vector}::vector) AS "score"
      FROM "agent_memory_item"
      WHERE "userId" = ${params.userId}
        AND "namespace" = ${namespace}
        AND "consentStatus" = 'active'
        AND "deletedAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${vector}::vector
      LIMIT ${limit}
    `);

    return rows.map(mapRow);
  }

  async put(params: {
    id: string;
    userId: string;
    namespace: AgentMemoryNamespace;
    content: string;
    data?: Record<string, unknown>;
    ttlDays?: number;
  }): Promise<void> {
    const normalizedContent = params.content.trim();
    if (!normalizedContent || normalizedContent.length > 2_000) {
      throw new AgentError(
        "AGENT_MEMORY_UNAVAILABLE",
        "Memory content must be between 1 and 2,000 characters.",
      );
    }

    const embedding = await getEmbeddings().embedQuery(normalizedContent);
    const vector = vectorLiteral(embedding);
    const ttlDays = Math.max(1, Math.min(params.ttlDays ?? AGENT_CONFIG.memoryTtlDays, 3650));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const namespace = namespaceSql(params.namespace);
    const data = params.data || {};

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "agent_memory_item"
        ("id", "userId", "namespace", "content", "data", "embedding", "expiresAt", "updatedAt")
      VALUES
        (${params.id}, ${params.userId}, ${namespace}, ${normalizedContent}, ${data}, ${vector}::vector, ${expiresAt}, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "content" = EXCLUDED."content",
        "data" = EXCLUDED."data",
        "embedding" = EXCLUDED."embedding",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW(),
        "deletedAt" = NULL,
        "consentStatus" = 'active'
    `);
  }

  async delete(params: { userId: string; id: string }): Promise<void> {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "agent_memory_item"
      SET "deletedAt" = NOW(), "consentStatus" = 'deleted', "updatedAt" = NOW()
      WHERE "id" = ${params.id} AND "userId" = ${params.userId}
    `);
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const deleted = await prisma.$executeRaw(Prisma.sql`
      UPDATE "agent_memory_item"
      SET "deletedAt" = ${now}, "consentStatus" = 'expired', "updatedAt" = ${now}
      WHERE "expiresAt" IS NOT NULL
        AND "expiresAt" <= ${now}
        AND "deletedAt" IS NULL
    `);
    return Number(deleted);
  }
}

export const agentMemoryStore = new AgentMemoryStore();
