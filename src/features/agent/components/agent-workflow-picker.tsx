"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  WorkflowIcon,
  ChevronDownIcon,
  XIcon,
  Loader2Icon,
  CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

export interface AgentWorkflowPickerProps {
  /** Currently selected workflow ID. */
  selectedWorkflowId: string | null;
  /** Called when a workflow is selected or detached. */
  onSelect: (workflowId: string | null, workflowName: string | null) => void;
  /** Trigger element variant. */
  variant?: "header" | "inline";
}

// ─── Component ───────────────────────────────────────────────

export function AgentWorkflowPicker({
  selectedWorkflowId,
  onSelect,
  variant = "header",
}: AgentWorkflowPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.workflows.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search,
    }),
  );

  const workflows = data?.items ?? [];
  const selectedWorkflow = selectedWorkflowId
    ? workflows.find((w: any) => w.id === selectedWorkflowId)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "header" ? (
          <button className="flex items-center gap-1.5 group text-left">
            <WorkflowIcon
              className={cn(
                "size-3 shrink-0",
                selectedWorkflowId ? "text-[#5c54a4]" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-[11px] truncate max-w-[180px] transition-colors",
                selectedWorkflowId
                  ? "text-foreground font-medium"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              {selectedWorkflow
                ? (selectedWorkflow as any).name
                : "Attach a workflow..."}
            </span>
            <ChevronDownIcon className="size-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            role="combobox"
            aria-expanded={open}
          >
            <WorkflowIcon className="size-3" />
            {selectedWorkflow
              ? (selectedWorkflow as any).name
              : "Select workflow..."}
            <ChevronDownIcon className="size-3 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search workflows..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}

            <CommandEmpty>No workflows found.</CommandEmpty>

            {/* Detach option */}
            {selectedWorkflowId && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__detach__"
                    onSelect={() => {
                      onSelect(null, null);
                      setOpen(false);
                    }}
                    className="text-muted-foreground"
                  >
                    <XIcon className="size-3.5 mr-2" />
                    Detach workflow
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="Your Workflows">
              {workflows.map((workflow: any) => (
                <CommandItem
                  key={workflow.id}
                  value={workflow.id}
                  onSelect={() => {
                    onSelect(workflow.id, workflow.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center gap-2"
                >
                  <WorkflowIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      workflow.id === selectedWorkflowId
                        ? "text-[#5c54a4]"
                        : "text-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{workflow.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Updated{" "}
                      {new Date(workflow.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {workflow.id === selectedWorkflowId && (
                    <CheckIcon className="size-3.5 text-[#5c54a4] shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
