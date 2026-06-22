"use client";

import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";
import {
  GlobeIcon,
  MailIcon,
  MousePointerIcon,
  TableIcon,
  XIcon,
} from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAtom } from "jotai";
import { nodeSelectorOpenAtom } from "@/features/editor/store/atoms";
import { NodeType } from "@/generated/prisma";
import { cn } from "@/lib/utils";

export type NodeTypeOption = {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};

const triggerNodes: NodeTypeOption[] = [
  {
    type: NodeType.MANUAL_TRIGGER,
    label: "Trigger manually",
    description: "Runs the flow on clicking a button. Good for getting started quickly",
    icon: MousePointerIcon,
  },
  {
    type: NodeType.GOOGLE_FORM_TRIGGER,
    label: "Google Form",
    description: "Runs the flow when a Google Form is submitted",
    icon: "/logos/googleform.svg",
  },
  {
    type: NodeType.STRIPE_TRIGGER,
    label: "Stripe Event",
    description: "Runs the flow when a Stripe Event is captured",
    icon: "/logos/stripe.svg",
  },
];

const executionNodes: NodeTypeOption[] = [
  {
    type: NodeType.HTTP_REQUEST,
    label: "HTTP Request",
    description: "Makes an HTTP request",
    icon: GlobeIcon,
  },
  {
    type: NodeType.GEMINI,
    label: "Gemini",
    description: "Uses Google Gemini to generate text",
    icon: "/logos/gemini.svg",
  },
  {
    type: NodeType.OPENAI,
    label: "OpenAI",
    description: "Uses OpenAI to generate text",
    icon: "/logos/openai.svg",
  },
  {
    type: NodeType.ANTHROPIC,
    label: "Anthropic",
    description: "Uses Anthropic to generate text",
    icon: "/logos/anthropic.svg",
  },
  {
    type: NodeType.DISCORD,
    label: "Discord",
    description: "Send a message to Discord",
    icon: "/logos/discord.svg",
  },
  {
    type: NodeType.SLACK,
    label: "Slack",
    description: "Send a message to Slack",
    icon: "/logos/slack.svg",
  },
  {
    type: NodeType.EMAIL,
    label: "Email",
    description: "Send an email through SMTP",
    icon: MailIcon,
  },
  {
    type: NodeType.GOOGLE_SHEETS,
    label: "Google Sheets",
    description: "Append a row to a Google Sheet",
    icon: TableIcon,
  },
];

export function NodeSelector() {
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();
  const [open, setOpen] = useAtom(nodeSelectorOpenAtom);

  const handleNodeSelect = useCallback((selection: NodeTypeOption) => {
    // Check if trying to add a manual trigger when one already exists
    if (selection.type === NodeType.MANUAL_TRIGGER) {
      const nodes = getNodes();
      const hasManualTrigger = nodes.some(
        (node) => node.type === NodeType.MANUAL_TRIGGER,
      );

      if (hasManualTrigger) {
        toast.error("Only one manual trigger is allowed per workflow");
        return;
      }
    }

    setNodes((nodes) => {
      const hasInitialTrigger = nodes.some(
        (node) => node.type === NodeType.INITIAL,
      );

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const flowPosition = screenToFlowPosition({
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
      });

      const newNode = {
        id: createId(),
        data: {},
        position: flowPosition,
        type: selection.type,
      };

      if (hasInitialTrigger) {
        return [newNode];
      }

      return [...nodes, newNode];
    });

    setOpen(false);
  }, [
    setNodes,
    getNodes,
    setOpen,
    screenToFlowPosition,
  ]);

  return (
    <aside 
      className={cn(
        "shrink-0 h-full overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out flex flex-col min-h-0",
        open ? "w-80 ml-2 opacity-100" : "w-0 ml-0 opacity-0"
      )}
    >
      <div className="w-80 h-full bg-[#f6f8fb] dark:bg-zinc-950 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 leading-tight">
              Triggers & Actions
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Select a step to add.
            </p>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/80 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700/50 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600/80 [&::-webkit-scrollbar-thumb]:rounded-full mt-2">
        <div className="pb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4 px-1">Triggers</h3>
          {triggerNodes.map((nodeType) => {
            const Icon = nodeType.icon;

            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto p-4 mb-3 rounded-xl cursor-pointer bg-white/40 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-[#5c54a4]/20 dark:hover:border-[#5c54a4]/40 transition-all duration-300 group"
                onClick={() => handleNodeSelect(nodeType)}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-[#f4f3fb] dark:bg-[#5c54a4]/10 border border-white dark:border-zinc-700 shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0">
                    {typeof Icon === "string" ? (
                      <img
                        src={Icon}
                        alt={nodeType.label}
                        className="size-5 object-contain"
                      />
                    ) : (
                      <Icon className="size-5 text-[#5c54a4]" />
                    )}
                  </div>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 group-hover:text-[#5c54a4] transition-colors truncate w-full">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5 line-clamp-2 w-full">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mx-1 my-4 h-[1px] bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-800 to-transparent" />

        <div className="pt-2 pb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4 px-1">Actions</h3>
          {executionNodes.map((nodeType) => {
            const Icon = nodeType.icon;

            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto p-4 mb-3 rounded-xl cursor-pointer bg-white/40 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-[#5c54a4]/20 dark:hover:border-[#5c54a4]/40 transition-all duration-300 group"
                onClick={() => handleNodeSelect(nodeType)}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-[#f4f3fb] dark:bg-[#5c54a4]/10 border border-white dark:border-zinc-700 shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0">
                    {typeof Icon === "string" ? (
                      <img
                        src={Icon}
                        alt={nodeType.label}
                        className="size-5 object-contain"
                      />
                    ) : (
                      <Icon className="size-5 text-[#5c54a4]" />
                    )}
                  </div>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 group-hover:text-[#5c54a4] transition-colors truncate w-full">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5 line-clamp-2 w-full">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </aside>
  );
};
