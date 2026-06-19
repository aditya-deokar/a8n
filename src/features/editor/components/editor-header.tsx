"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SaveIcon } from "lucide-react";
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
import { editorAtom } from "../store/atoms";
import { AddNodeButton } from "./add-node-button";

export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  const editor = useAtomValue(editorAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) {
      return;
    }

    const nodes = editor.getNodes();
    const edges = editor.getEdges();

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  }

  return (
    <div className="ml-auto">
      <Button 
        size="sm" 
        onClick={handleSave} 
        disabled={saveWorkflow.isPending}
        className="h-9 bg-[#5c54a4] hover:bg-[#4b448a] text-white rounded-xl px-4 shadow-md shadow-[#5c54a4]/20 gap-2 transition-all"
      >
        <SaveIcon className="size-4" />
        <span className="font-medium hidden sm:inline">Save Workflow</span>
        <span className="font-medium sm:hidden">Save</span>
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
    <BreadcrumbItem onClick={() => setIsEditing(true)} className="cursor-pointer font-semibold text-gray-900 dark:text-zinc-100 hover:text-[#5c54a4] dark:hover:text-[#7972b9] transition-all bg-white/50 dark:bg-zinc-900/50 px-3 py-1 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 hover:shadow-sm">
      {workflow.name}
    </BreadcrumbItem>
  )
};

export const EditorBreadcrumbs = ({ workflowId }: { workflowId: string }) => {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link prefetch href="/workflows" className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 font-medium transition-colors">
              Workflows
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <EditorNameInput workflowId={workflowId} />
      </BreadcrumbList>
    </Breadcrumb>
  )
};

export const EditorHeader = ({ workflowId }: { workflowId: string }) => {
  return (
    <div className="flex items-stretch gap-2 shrink-0">
      <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0 h-[88px]">
        <SidebarTrigger className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl size-10 [&>svg]:size-5" />
      </div>
      <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex-1 flex items-center px-8 h-[88px]">
        <div className="flex flex-row items-center justify-between gap-x-4 w-full">
          <EditorBreadcrumbs workflowId={workflowId} />
          <EditorSaveButton workflowId={workflowId} />
        </div>
      </div>
      <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0 h-[88px]">
        <AddNodeButton />
      </div>
    </div>
  );
};
