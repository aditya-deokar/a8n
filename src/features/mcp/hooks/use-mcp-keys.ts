import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useMcpKeys = () => {
  const trpc = useTRPC();
  return useQuery(trpc.mcp.listKeys.queryOptions());
};

export const useCreateMcpKey = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.mcp.createKey.mutationOptions({
      onSuccess: (data) => {
        toast.success(`API Key "${data.record.name}" created successfully`);
        queryClient.invalidateQueries(trpc.mcp.listKeys.queryOptions());
      },
      onError: (error) => {
        toast.error(`Failed to create API key: ${error.message}`);
      },
    }),
  );
};

export const useRevokeMcpKey = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.mcp.revokeKey.mutationOptions({
      onSuccess: () => {
        toast.success("API Key revoked successfully");
        queryClient.invalidateQueries(trpc.mcp.listKeys.queryOptions());
      },
      onError: (error) => {
        toast.error(`Failed to revoke API key: ${error.message}`);
      },
    }),
  );
};
