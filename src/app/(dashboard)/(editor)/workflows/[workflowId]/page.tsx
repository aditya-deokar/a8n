import {
  Editor,
  EditorError,
  EditorLoading
} from "@/features/editor/components/editor";
import { EditorHeader, EditorSaveButton } from "@/features/editor/components/editor-header";
import { AddNodeButton } from "@/features/editor/components/add-node-button";
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
            <div className="flex flex-col h-full w-full min-h-0 gap-0 md:gap-2 relative z-10">
              <EditorHeader workflowId={workflowId} />
              <main className="relative flex-1 h-full flex flex-col bg-[#f6f8fb] dark:bg-[#18181b] md:rounded-2xl border-0 md:border-4 border-white/40 dark:border-zinc-800/40 md:shadow-sm overflow-hidden min-w-0 min-h-0">
                <div className="flex-1 w-full h-full relative z-0">
                  <Editor workflowId={workflowId} />
                </div>
                {/* Floating Node Selector placed inside main to overlay the grid */}
                <NodeSelector />
              </main>
              {/* Mobile Bottom Action Bar */}
              <div className="md:hidden flex items-center justify-between gap-3 p-3 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 shrink-0 safe-area-bottom z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex-1 min-w-0">
                  <AddNodeButton />
                </div>
                <div className="flex-1 min-w-0">
                  <EditorSaveButton workflowId={workflowId} />
                </div>
              </div>
            </div>
          </ReactFlowProvider>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
};

export default Page;
