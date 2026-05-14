import React, { Suspense } from "react";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-components";
import { McpDashboardView } from "@/features/mcp/components/mcp-dashboard-view";
import { prefetchMcpKeys } from "@/features/mcp/server/prefetch";

const Page = async () => {
  await requireAuth();

  // Prefetch MCP API keys state for SSR hydration
  prefetchMcpKeys();

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<ErrorView message="Failed to load MCP Dashboard" />}>
        <Suspense fallback={<LoadingView message="Loading MCP Server capabilities..." />}>
          <McpDashboardView />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
