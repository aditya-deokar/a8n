import { prefetch, trpc } from "@/trpc/server";

/**
 * Prefetch all MCP API keys for server hydration
 */
export const prefetchMcpKeys = () => {
  return prefetch(trpc.mcp.listKeys.queryOptions());
};
