/**
 * API Key Service
 *
 * Handles generation, hashing, validation, and lifecycle management
 * of MCP API keys. Keys are stored as SHA-256 hashes — the raw key
 * is returned only once at creation time.
 *
 * Inspired by Cloudflare's approach: keys have scoped permissions,
 * expiration dates, and are tracked for last-used timestamps.
 */

import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db";
import { MCP_CONFIG } from "../config";
import type { McpScope } from "./scopes";
import { DEFAULT_SCOPES } from "./scopes";

// ─── Hashing ────────────────────────────────────────────────

/**
 * Generate a SHA-256 hash of a raw API key.
 * This is the only form stored in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generate a cryptographically secure random API key
 * with the configured prefix for easy identification.
 */
export function generateRawApiKey(): string {
  const randomPart = randomBytes(MCP_CONFIG.API_KEY_LENGTH)
    .toString("base64url")
    .slice(0, MCP_CONFIG.API_KEY_LENGTH);
  return `${MCP_CONFIG.API_KEY_PREFIX}${randomPart}`;
}

/**
 * Extract the prefix portion of a key for display purposes.
 * Shows first 12 characters + "..." for identification without exposing the full key.
 */
export function getKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, MCP_CONFIG.API_KEY_PREFIX.length + 8);
}

// ─── CRUD Operations ────────────────────────────────────────

/**
 * Create a new API key for a user.
 *
 * @returns The raw API key (shown once) and the database record.
 */
export async function createApiKey(params: {
  userId: string;
  name: string;
  scopes?: McpScope[];
  expiresAt?: Date;
}) {
  const { userId, name, scopes = DEFAULT_SCOPES, expiresAt } = params;

  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getKeyPrefix(rawKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      scopes,
      userId,
      expiresAt: expiresAt ?? null,
    },
  });

  return {
    /** The raw key — this is the ONLY time it's available */
    rawKey,
    /** The database record (without the raw key) */
    record: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
    },
  };
}

/**
 * Validate an API key and return the associated user + scopes.
 * Also updates the `lastUsedAt` timestamp for tracking.
 *
 * @returns The API key record with user data, or null if invalid.
 */
export async function validateApiKey(rawKey: string) {
  // Quick prefix check to avoid unnecessary DB queries
  if (!rawKey.startsWith(MCP_CONFIG.API_KEY_PREFIX)) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!apiKey) return null;

  // Check if the key has been revoked
  if (apiKey.revokedAt) return null;

  // Check if the key has expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used timestamp (fire-and-forget, don't block the request)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Non-critical — silently ignore update failures
    });

  return apiKey;
}

/**
 * List all active (non-revoked) API keys for a user.
 * Keys are returned with masked prefixes only.
 */
export async function listApiKeys(userId: string) {
  const keys = await prisma.apiKey.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return keys;
}

/**
 * Revoke an API key by soft-deleting (setting revokedAt timestamp).
 * This preserves audit trail while immediately invalidating the key.
 */
export async function revokeApiKey(params: {
  keyId: string;
  userId: string;
}) {
  const { keyId, userId } = params;

  const apiKey = await prisma.apiKey.updateMany({
    where: {
      id: keyId,
      userId,
      revokedAt: null, // Can only revoke active keys
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return apiKey.count > 0;
}
