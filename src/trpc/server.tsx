import 'server-only'; // <-- ensure this file cannot be imported from the client
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { createTRPCContext } from './init';
import { makeQueryClient } from './query-client';
import { appRouter } from './routers/_app';
import { dehydrate, HydrationBoundary, type QueryKey } from '@tanstack/react-query';
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});
// ...
export const caller = appRouter.createCaller(createTRPCContext);

type PrefetchableQueryOptions = {
  queryKey: QueryKey;
};

function isInfiniteQuery(queryKey: QueryKey) {
  const queryType = queryKey[1];
  return (
    typeof queryType === 'object' &&
    queryType !== null &&
    'type' in queryType &&
    queryType.type === 'infinite'
  );
}

export async function prefetch(queryOptions: PrefetchableQueryOptions) {
  const queryClient = getQueryClient();
  if (isInfiniteQuery(queryOptions.queryKey)) {
    await queryClient.prefetchInfiniteQuery(
      queryOptions as Parameters<typeof queryClient.prefetchInfiniteQuery>[0],
    );
  } else {
    await queryClient.prefetchQuery(
      queryOptions as Parameters<typeof queryClient.prefetchQuery>[0],
    );
  }
}

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
