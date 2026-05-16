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

interface PageProps {
  params: Promise<{
    workflowId: string;
  }>
};

const Page = async ({ params }: PageProps) => {
  await requireAuth();

  const { workflowId } = await params;
  prefetchWorkflow(workflowId);

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<EditorError />}>
        <Suspense fallback={<EditorLoading />}>
          <main className="relative flex-1 h-full w-full flex flex-col bg-[#fcfcfd] rounded-[1.5rem] overflow-hidden shadow-inner">
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-center pointer-events-none">
              <div className="pointer-events-auto w-full max-w-4xl">
                <EditorHeader workflowId={workflowId} />
              </div>
            </div>
            <div className="flex-1 w-full h-full">
              <Editor workflowId={workflowId} />
            </div>
          </main>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  )
};

export default Page;
