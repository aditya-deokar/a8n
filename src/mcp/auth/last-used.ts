/**
 * Credentials record a `lastUsedAt` timestamp, which would otherwise mean one
 * UPDATE (and one WAL write) on every single MCP request. Sub-minute precision
 * buys nothing for a "last used" display, so skip the write when the stored
 * value is already recent.
 */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export function shouldRecordLastUsed(
  lastUsedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastUsedAt) return true;
  return now.getTime() - lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS;
}
