"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SaveIcon, ChevronLeftIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSuspenseWorkflow, useUpdateWorkflow, useUpdateWorkflowName } from "@/features/workflows/hooks/use-workflows";
import { useAtomValue } from "jotai";
import { editorAtom, nodeSelectorOpenAtom } from "../store/atoms";
import { AddNodeButton } from "./add-node-button";
import { cn } from "@/lib/utils";

export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  const editor = useAtomValue(editorAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) {
      return;
    }

    const nodes = editor.getNodes().map((node) => ({
      id: node.id,
      type: node.type ?? "INITIAL",
      position: node.position,
      data: node.data,
    }));
    const edges = editor.getEdges();

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  }

  return (
    <div className="ml-auto flex shrink-0 w-full md:w-auto">
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saveWorkflow.isPending}
        className="w-full md:w-auto h-12 md:h-9 bg-gradient-to-b from-[#5c54a4] to-[#9187ce] hover:opacity-90 text-white px-4 shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset] gap-2 transition-all duration-300 border-0"
      >
        <SaveIcon className="size-4" />
        <span className="text-sm font-medium hidden sm:inline">Save Workflow</span>
        <span className="text-sm font-medium sm:hidden">Save</span>
      </Button>
    </div>
  )
};

export const EditorNameInput = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflowName();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(workflow.name);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workflow.name) {
      setName(workflow.name);
    }
  }, [workflow.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (name === workflow.name) {
      setIsEditing(false);
      return;
    }

    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        name,
      });
    } catch {
      setName(workflow.name);
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setName(workflow.name);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        disabled={updateWorkflow.isPending}
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-8 w-auto min-w-[150px] px-3 rounded-lg border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-[#5c54a4]/20 transition-all shadow-sm text-sm"
      />
    )
  }

  return (
    <BreadcrumbItem onClick={() => setIsEditing(true)} className="cursor-pointer font-semibold text-gray-900 dark:text-zinc-100 hover:text-[#5c54a4] dark:hover:text-[#7972b9] transition-all bg-white/50 dark:bg-zinc-900/50 px-2 md:px-3 py-1.5 md:py-1 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 hover:shadow-sm truncate min-w-0 max-w-[200px] sm:max-w-none flex-1">
      <span className="truncate block text-sm md:text-base">{workflow.name}</span>
    </BreadcrumbItem>
  )
};

export const EditorBreadcrumbs = ({ workflowId }: { workflowId: string }) => {
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap min-w-0">
        <BreadcrumbItem className="shrink-0 hidden sm:block">
          <BreadcrumbLink asChild>
            <Link prefetch href="/workflows" className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 font-medium transition-colors">
              Workflows
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:block shrink-0" />
        <EditorNameInput workflowId={workflowId} />
      </BreadcrumbList>
    </Breadcrumb>
  )
};

export const EditorHeader = ({ workflowId }: { workflowId: string }) => {
  const selectorOpen = useAtomValue(nodeSelectorOpenAtom);

  return (
    <div className="flex items-stretch gap-2 shrink-0 w-full min-w-0">
      <div className="hidden md:flex bg-[#f6f8fb] dark:bg-zinc-900 rounded-2xl border-4 border-white/40 dark:border-zinc-800/40 shadow-sm items-center justify-center px-6 shrink-0 h-[88px]">
        <SidebarTrigger className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl size-10 [&>svg]:size-5" />
      </div>
      <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl md:bg-[#f6f8fb] md:dark:bg-zinc-900 md:rounded-2xl border-b border-gray-100 dark:border-zinc-800 md:border-4 md:border-white/40 md:dark:border-zinc-800/40 shadow-sm flex-1 flex items-center px-2 sm:px-4 md:px-8 h-14 md:h-[88px] min-w-0">
        <div className="flex flex-row items-center justify-between gap-x-1.5 md:gap-x-4 w-full min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1 sm:pr-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 md:hidden shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 bg-black/5 dark:bg-white/5 rounded-lg" asChild>
              <Link href="/workflows">
                <ChevronLeftIcon className="size-5" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <EditorBreadcrumbs workflowId={workflowId} />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <AddNodeButton />
            <EditorSaveButton workflowId={workflowId} />
          </div>
        </div>
      </div>
    </div>
  );
};
