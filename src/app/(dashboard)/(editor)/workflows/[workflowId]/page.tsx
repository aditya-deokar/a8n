import {
  Editor,
  EditorError,
  EditorLoading
} from "@/features/editor/components/editor";
import { EditorHeader } from "@/features/editor/components/editor-header";
import { prefetchWorkflow } from "@/features/workflows/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ReactFlowProvider } from "@xyflow/react";
import { NodeSelector } from "@/components/node-selector";

interface PageProps {
  params: Promise<{
    workflowId: string;
  }>
};

const Page = async ({ params }: PageProps) => {
  await requireAuth();

  const { workflowId } = await params;
  await prefetchWorkflow(workflowId);

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<EditorError />}>
        <Suspense fallback={<EditorLoading />}>
          <ReactFlowProvider>
            <div className="flex flex-col h-full w-full min-h-0 gap-2 relative z-10">
              <EditorHeader workflowId={workflowId} />
              <main className="relative flex-1 h-full flex flex-col bg-[#f6f8fb] dark:bg-[#18181b] rounded-2xl border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden min-w-0 min-h-0">
                <div className="flex-1 w-full h-full relative z-0">
                  <Editor workflowId={workflowId} />
                </div>
                {/* Floating Node Selector placed inside main to overlay the grid */}
                <NodeSelector />
              </main>
            </div>
          </ReactFlowProvider>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
};

export default Page;
