import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';
import { logger, normalizeError, withRequestLogging } from '@/lib/logging';

const rawHandler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ path, error }) {
      if (process.env.NODE_ENV !== "test") {
        logger.error(
          {
            component: "api",
            event: "trpc_procedure_failed",
            procedurePath: path ?? "<unknown>",
            error: normalizeError(error),
          },
          "tRPC procedure failed.",
        );
      }
    },
  });

const handler = withRequestLogging(rawHandler, {
  component: "api",
  route: "/api/trpc",
  eventPrefix: "trpc_request",
});

export { handler as GET, handler as POST };
