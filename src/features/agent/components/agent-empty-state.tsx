"use client";

import { SparklesIcon, ArrowRightIcon, WorkflowIcon, BugIcon, ShieldCheckIcon, PuzzleIcon, ZapIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface AgentEmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

// ─── Suggestions ─────────────────────────────────────────────

const suggestions = [
  {
    title: "Build a workflow",
    description: "Create an automation from scratch",
    icon: WorkflowIcon,
    prompt: "Build a workflow that",
  },
  {
    title: "Explain my workflow",
    description: "Understand what each node does",
    icon: ZapIcon,
    prompt: "Explain how my workflow works step by step",
  },
  {
    title: "Find integrations",
    description: "Connect services together",
    icon: PuzzleIcon,
    prompt: "Find integrations for",
  },
  {
    title: "Debug an execution",
    description: "Diagnose a failed run",
    icon: BugIcon,
    prompt: "Debug my last failed execution and suggest fixes",
  },
  {
    title: "Add error handling",
    description: "Make workflows more robust",
    icon: ShieldCheckIcon,
    prompt: "Add error handling to my workflow",
  },
  {
    title: "Connect a new service",
    description: "Set up a new integration",
    icon: PuzzleIcon,
    prompt: "Help me connect a new service to my workflow",
  },
];

// ─── Component ───────────────────────────────────────────────

export function AgentEmptyState({ onSuggestionClick }: AgentEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="relative">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-[#5c54a4]/20 to-[#9187ce]/20 flex items-center justify-center ring-1 ring-[#5c54a4]/10">
            <SparklesIcon className="size-8 text-[#5c54a4] dark:text-[#9187ce]" />
          </div>
          <div className="absolute -top-1 -right-1 size-4 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            a8n Agent
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            I can build, modify, explain, and debug your workflows. 
            Attach a workflow or start a conversation from scratch.
          </p>
        </div>
      </div>

      {/* Suggestion Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className="group flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-card/50 hover:bg-accent/50 hover:border-[#5c54a4]/20 text-left transition-all duration-200 hover:shadow-sm"
          >
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-[#5c54a4]/10 transition-colors">
              <suggestion.icon className="size-4 text-muted-foreground group-hover:text-[#5c54a4] transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{suggestion.title}</span>
                <ArrowRightIcon className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-xs text-muted-foreground">{suggestion.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
