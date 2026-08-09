"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Thread List ─────────────────────────────────────────────

/**
 * Query hook for listing agent threads, optionally filtered by workflow.
 */
export function useAgentThreads(workflowId?: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.agent.listThreads.queryOptions({ workflowId }),
  );
}

// ─── Thread CRUD ─────────────────────────────────────────────

/**
 * Mutation hook to create a new agent thread.
 */
export function useCreateAgentThread() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.agent.createThread.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.agent.listThreads.queryOptions({}).queryKey,
        });
      },
    }),
  );
}

/**
 * Mutation hook to ensure a thread exists for the given workflow.
 * Creates one if none exists; returns the existing one otherwise.
 *
 * This is the primary thread-loading mechanism used by the editor
 * sidebar, which always needs a thread scoped to the open workflow.
 */
export function useEnsureAgentThread() {
  const trpc = useTRPC();
  return useMutation(trpc.agent.ensureThread.mutationOptions());
}

/**
 * Mutation hook to archive an agent thread (soft delete).
 */
export function useArchiveAgentThread() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.agent.archiveThread.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.agent.listThreads.queryOptions({}).queryKey,
        });
      },
    }),
  );
}

// ─── Single Thread ───────────────────────────────────────────

/**
 * Query hook for fetching a single thread by ID.
 */
export function useAgentThread(threadId: string | null) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.agent.getThread.queryOptions({ threadId: threadId! }),
    enabled: !!threadId,
  });
}
