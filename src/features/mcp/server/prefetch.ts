import { prefetch, trpc } from "@/trpc/server";

/**
 * Prefetch all MCP API keys for server hydration
 */
export const prefetchMcpKeys = () => {
  return prefetch(trpc.mcp.listKeys.queryOptions());
};

export const prefetchMcpSecuritySummary = () => {
  return prefetch(trpc.mcp.securitySummary.queryOptions());
};

export const prefetchMcpOAuthConnections = () => {
  return prefetch(trpc.mcp.listOAuthConnections.queryOptions());
};
