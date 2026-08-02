"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2Icon, TrashIcon, Trash2Icon, AlertTriangleIcon,
  BrainIcon, SparklesIcon, WrenchIcon, MessageSquareIcon 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "workflow-preferences": {
    label: "Preferences",
    icon: <SparklesIcon className="size-3" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  },
  "workflow-patterns": {
    label: "Patterns",
    icon: <WrenchIcon className="size-3" />,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  },
  "conversation-summaries": {
    label: "Summaries",
    icon: <MessageSquareIcon className="size-3" />,
    color: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
  },
};

export function AgentMemoryPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const memoriesQuery = useQuery(
    trpc.agent.listMemories.queryOptions({ limit: 50 })
  );

  const deleteMutation = useMutation(
    trpc.agent.deleteMemory.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.agent.listMemories.queryOptions({}).queryKey });
        toast.success("Memory deleted");
      },
    })
  );

  const deleteAllMutation = useMutation(
    trpc.agent.deleteAllMemories.mutationOptions({
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: trpc.agent.listMemories.queryOptions({}).queryKey });
        toast.success(`Cleared ${data.deleted} memories`);
      },
    })
  );

  const memories = memoriesQuery.data || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <BrainIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Agent Memory ({memories.length})
          </span>
        </div>
        {memories.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive px-2">
                <Trash2Icon className="size-3 mr-1" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all agent memories?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {memories.length} memories the agent has learned about your preferences and patterns. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => deleteAllMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteAllMutation.isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    "Clear All"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Memory List */}
      <ScrollArea className="flex-1">
        <div className="p-4 flex flex-col gap-3">
          {memoriesQuery.isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {memoriesQuery.isError && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangleIcon className="size-5 text-destructive" />
              <p className="text-xs text-muted-foreground">Failed to load memories</p>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => memoriesQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!memoriesQuery.isLoading && memories.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <BrainIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No memories yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                  As you chat with the agent, it will learn your preferences and patterns.
                </p>
              </div>
            </div>
          )}

          {memories.map((memory: any) => {
            const config = CATEGORY_CONFIG[memory.category] || CATEGORY_CONFIG["workflow-preferences"];
            return (
              <div 
                key={memory.id} 
                className="group relative p-3 rounded-xl bg-muted/50 border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 gap-1 font-normal ${config.color}`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ memoryId: memory.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <TrashIcon className="size-3" />
                  </Button>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{memory.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(memory.createdAt).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
