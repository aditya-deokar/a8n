"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Hook ────────────────────────────────────────────────────

/**
 * React hook for managing the agent's long-term memories.
 *
 * Extracted from the inline tRPC setup in
 * `src/features/editor/components/agent-memory-panel.tsx` (lines 48–68).
 * Both the editor memory panel and the standalone agent page use this
 * hook to list, delete, and clear memories.
 */
export function useAgentMemories(options?: { limit?: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const memoriesQuery = useQuery(
    trpc.agent.listMemories.queryOptions({ limit: options?.limit ?? 50 }),
  );

  const deleteMutation = useMutation(
    trpc.agent.deleteMemory.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.agent.listMemories.queryOptions({}).queryKey,
        });
        toast.success("Memory deleted");
      },
    }),
  );

  const deleteAllMutation = useMutation(
    trpc.agent.deleteAllMemories.mutationOptions({
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({
          queryKey: trpc.agent.listMemories.queryOptions({}).queryKey,
        });
        toast.success(`Cleared ${data.deleted} memories`);
      },
    }),
  );

  return {
    /** List of user's long-term memories. */
    memories: memoriesQuery.data ?? [],
    /** Whether the initial memory list is loading. */
    isLoading: memoriesQuery.isLoading,
    /** Whether the memory list query failed. */
    isError: memoriesQuery.isError,
    /** Refetch the memory list. */
    refetch: memoriesQuery.refetch,
    /** Delete a single memory by ID. */
    deleteMemory: deleteMutation.mutate,
    /** Whether a single-memory delete is in-flight. */
    isDeletingMemory: deleteMutation.isPending,
    /** Delete all memories for the current user. */
    deleteAllMemories: deleteAllMutation.mutate,
    /** Whether a clear-all operation is in-flight. */
    isDeletingAll: deleteAllMutation.isPending,
  };
}
