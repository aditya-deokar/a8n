import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { AgentChatPage } from "@/features/agent/components/agent-chat-page";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-components";

const Page = async () => {
  await requireAuth();

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<ErrorView message="Failed to load Agent Chat" />}>
        <Suspense fallback={<LoadingView message="Loading Agent..." />}>
          <AgentChatPage />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
