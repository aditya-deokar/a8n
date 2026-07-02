/**
 * Rate Limiter Middleware
 *
 * In-memory sliding window rate limiter keyed by API key or user ID.
 * Protects the MCP server from excessive requests.
 *
 * Note: For multi-instance deployments, replace with Redis-backed
 * rate limiting (e.g., Upstash Redis with @upstash/ratelimit).
 */

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
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
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
