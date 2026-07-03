/**
 * Rate Limiter Middleware
 *
 * In-memory sliding window rate limiter keyed by API key or user ID.
 * Protects the MCP server from excessive requests.
 *
 * Phase 12 adds a Postgres-backed adapter for multi-instance production.
 */

import { randomUUID } from "node:crypto";
import { MCP_CONFIG } from "../config";

interface RateLimitEntry {
  /** Request timestamps within the current window */
  timestamps: number[];
}

/** In-memory store keyed by identifier (API key ID or user ID) */
const store = new Map<string, RateLimitEntry>();

/** Periodic cleanup interval (every 5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Auto-cleanup stale entries
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const windowMs = MCP_CONFIG.RATE_LIMIT.WINDOW_MS;

    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < windowMs,
      );
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  (cleanupTimer as unknown as { unref?: () => void }).unref?.();
}

/** Result of a rate limit check */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  backend?: "memory" | "database";
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param identifier - Unique key (API key ID or user ID)
 * @param tier - The user's subscription tier (affects limits)
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(
  identifier: string,
  tier: "free" | "pro" = "free",
): RateLimitResult {
  const now = Date.now();
  const windowMs = MCP_CONFIG.RATE_LIMIT.WINDOW_MS;
  const maxRequests =
    tier === "pro"
      ? MCP_CONFIG.RATE_LIMIT.PRO_TIER
      : MCP_CONFIG.RATE_LIMIT.FREE_TIER;

  // Get or create entry
  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(identifier, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  // Check if the limit is exceeded
  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + windowMs - now;

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
      backend: "memory",
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
    backend: "memory",
  };
}

function rateLimitBackend(): "memory" | "database" {
  return MCP_CONFIG.RATE_LIMIT.BACKEND === "database" ? "database" : "memory";
}

function maxRequestsForTier(tier: "free" | "pro") {
  return tier === "pro"
    ? MCP_CONFIG.RATE_LIMIT.PRO_TIER
    : MCP_CONFIG.RATE_LIMIT.FREE_TIER;
}

/**
 * Check rate limits using the configured production backend.
 *
 * In development this delegates to the in-memory limiter. In production set
 * `MCP_RATE_LIMIT_BACKEND=database` so all app instances share one Postgres
 * counter table.
 */
export async function checkRateLimitForRequest(
  identifier: string,
  tier: "free" | "pro" = "free",
): Promise<RateLimitResult> {
  if (rateLimitBackend() === "memory") {
    return checkRateLimit(identifier, tier);
  }

  return checkDatabaseRateLimit(identifier, tier);
}

async function checkDatabaseRateLimit(
  identifier: string,
  tier: "free" | "pro",
): Promise<RateLimitResult> {
  const prisma = (await import("@/lib/db")).default;
  const now = Date.now();
  const nowDate = new Date(now);
  const windowMs = MCP_CONFIG.RATE_LIMIT.WINDOW_MS;
  const maxRequests = maxRequestsForTier(tier);
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs * 2);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "mcp_rate_limit_bucket"
      ("id", "identifier", "tier", "windowStart", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${identifier}, ${tier}, ${windowStart}, 1, ${expiresAt}, ${nowDate}, ${nowDate})
    ON CONFLICT ("identifier", "tier", "windowStart")
    DO UPDATE SET
      "count" = "mcp_rate_limit_bucket"."count" + 1,
      "updatedAt" = ${nowDate},
      "expiresAt" = ${expiresAt}
    RETURNING "count";
  `;

  const count = Number(rows[0]?.count || 1);
  const resetMs = Math.max(windowStartMs + windowMs - now, 0);

  return {
    allowed: count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(maxRequests - count, 0),
    resetMs,
    backend: "database",
  };
}

export async function cleanupExpiredRateLimitBuckets(now = new Date()) {
  const prisma = (await import("@/lib/db")).default;
  const deleted = await prisma.$executeRaw`
    DELETE FROM "mcp_rate_limit_bucket"
    WHERE "expiresAt" < ${now};
  `;
  return { rateLimitBucketsDeleted: Number(deleted) };
}

/**
 * Build standard rate limit headers for the HTTP response.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
  };
}
