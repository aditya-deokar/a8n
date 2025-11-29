import Workflows, { WorkflowContainer, WorkflowError, WorkflowLoading } from '@/features/workflows/components/workflows';
import { workflowsParamsLoader } from '@/features/workflows/server/params-loader';
import { prefetchWorkflows } from '@/features/workflows/server/prefetch';
import { requireAuth } from '@/lib/auth-utils'
import { HydrateClient } from '@/trpc/server';
import { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary'

type Props={
  searchParams: Promise<SearchParams>;
}
const page = async({ searchParams }: Props) => {
    await requireAuth();

    const params= await workflowsParamsLoader(searchParams);

    prefetchWorkflows(params);

  return (
   <WorkflowContainer>

     <HydrateClient>
      <ErrorBoundary fallback={<WorkflowError/>}>
        <Suspense fallback= {<WorkflowLoading />}>
          <Workflows   />
        </Suspense>

      </ErrorBoundary>
    </HydrateClient>

   </WorkflowContainer>
  )
}

export default page