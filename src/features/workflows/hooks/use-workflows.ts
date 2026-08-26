import { useTRPC } from "@/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWorkflowsParams } from "./use-workflows-params";

/**
 * Hook to fetch all workflows using suspense
 */
export const useSuspenseWorkflows = () => {
  const trpc = useTRPC();
  const [params] = useWorkflowsParams();
  
  return useSuspenseQuery(trpc.workflows.getMany.queryOptions(params));
};

/**
 * Hook to create a new workflow
 */
export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" created`);
        queryClient.invalidateQueries(
          trpc.workflows.getMany.queryOptions({}),
        );
      },
      onError: (error) => {
        toast.error(`Failed to create workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to remove a workflow
 */
export const useRemoveWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.remove.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" removed`);
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          trpc.workflows.getOne.queryFilter({ id: data.id }),
        );
      }
    })
  )
}

/**
 * Hook to fetch a single workflow using suspense
 */
export const useSuspenseWorkflow = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.workflows.getOne.queryOptions({ id }));
};

/**
 * Hook to update a workflow name
 */
export const useUpdateWorkflowName = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.updateName.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" updated`);
        queryClient.invalidateQueries(
          trpc.workflows.getMany.queryOptions({}),
        );
        queryClient.invalidateQueries(
          trpc.workflows.getOne.queryOptions({ id: data.id }),
        );
      },
      onError: (error) => {
        toast.error(`Failed to update workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to update a workflow
 */
export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.update.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" saved`);
        queryClient.invalidateQueries(
          trpc.workflows.getMany.queryOptions({}),
        );
        queryClient.invalidateQueries(
          trpc.workflows.getOne.queryOptions({ id: data.id }),
        );
      },
      onError: (error) => {
        toast.error(`Failed to save workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to execute a workflow
 */
export const useExecuteWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.execute.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" executed`);
        // Surface the fresh RUNNING execution in the executions list.
        queryClient.invalidateQueries(
          trpc.executions.getMany.queryOptions({}),
        );
      },
      onError: (error) => {
        toast.error(`Failed to execute workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to toggle workflow activation
 */
export const useSetActiveWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.setActive.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.active
            ? "Workflow activated — webhook triggers are now live"
            : "Workflow deactivated",
        );
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
      },
      onError: (error) => {
        toast.error(`Failed to update workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to duplicate a workflow
 */
export const useDuplicateWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.duplicate.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
      },
      onError: (error) => {
        toast.error(`Failed to duplicate workflow: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to fetch workflow version history
 */
export const useWorkflowVersions = (
  workflowId: string,
  options?: { refetchInterval?: number },
) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.workflows.getVersions.queryOptions(
      { workflowId },
      options,
    ),
  );
};

/**
 * Hook to restore a workflow version
 */
export const useRestoreWorkflowVersion = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.restoreVersion.mutationOptions({
      onSuccess: (data) => {
        toast.success("Version restored");
        queryClient.invalidateQueries(trpc.workflows.getOne.queryOptions({ id: data.id }));
        queryClient.invalidateQueries(
          trpc.workflows.getVersions.queryOptions({ workflowId: data.id }),
        );
      },
      onError: (error) => {
        toast.error(`Failed to restore version: ${error.message}`);
      },
    }),
  );
};

/**
 * Hook to store an encrypted webhook secret on a trigger node
 */
export const useSetWebhookSecret = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.workflows.setWebhookSecret.mutationOptions({
      onError: (error) => {
        toast.error(`Failed to save webhook secret: ${error.message}`);
      },
    }),
  );
};
