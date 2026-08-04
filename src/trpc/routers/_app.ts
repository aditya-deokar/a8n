import { createTRPCRouter } from '../init';
import { workflowsRouter } from '@/features/workflows/server/routers';
import { credentialsRouter } from '@/features/credentials/server/routers';
import { executionsRouter } from '@/features/executions/server/routers';
import { mcpRouter } from '@/features/mcp/server/routers';
import { agentRouter } from '@/features/agent/server/routers';

export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
  credentials: credentialsRouter,
  executions: executionsRouter,
  mcp: mcpRouter,
  agent: agentRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
