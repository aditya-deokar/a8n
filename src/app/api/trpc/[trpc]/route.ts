import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ path, error }) {
      if (process.env.NODE_ENV !== "test") {
        console.error(`[trpc] ${path ?? "<unknown>"} failed`, error);
      }
    },
  });
export { handler as GET, handler as POST };
