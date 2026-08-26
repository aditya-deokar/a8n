import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExecutionStatus } from "@/generated/prisma";
import { useExecutionsParams } from "./use-executions-params";

/**
 * Hook to fetch all executions using suspense.
 * Polls while any execution is still running so the list updates live.
 */
export const useSuspenseExecutions = () => {
  const trpc = useTRPC();
  const [params] = useExecutionsParams();

  return useSuspenseQuery(
    trpc.executions.getMany.queryOptions(params, {
      refetchInterval: (query) => {
        const data = query.state.data as
          | { items?: Array<{ status: ExecutionStatus }> }
          | undefined;
        const hasRunning = data?.items?.some(
          (execution) => execution.status === ExecutionStatus.RUNNING,
        );
        return hasRunning ? 5_000 : false;
      },
    }),
  );
};

/**
 * Hook to fetch a single execution using suspense.
 * Polls while the execution is running so the timeline updates live.
 */
export const useSuspenseExecution = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.executions.getOne.queryOptions({ id }, {
      refetchInterval: (query) => {
        const data = query.state.data as
          | { status?: ExecutionStatus }
          | undefined;
        return data?.status === ExecutionStatus.RUNNING ? 3_000 : false;
      },
    }),
  );
};
