"use client";

import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";
import {
  GlobeIcon,
  MousePointerIcon,
} from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NodeType } from "@/generated/prisma";

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
];


interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function NodeSelector({
  open,
  onOpenChange,
  children
}: NodeSelectorProps) {
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();

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

    onOpenChange(false);
  }, [
    setNodes,
    getNodes,
    onOpenChange,
    screenToFlowPosition,
  ]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300/50 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400/80 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-xl font-bold tracking-tight">
            What triggers this workflow?
          </SheetTitle>
          <SheetDescription className="text-gray-500">
            A trigger is a step that starts your workflow.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-2">
          {triggerNodes.map((nodeType) => {
            const Icon = nodeType.icon;

            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto p-4 mb-3 rounded-xl cursor-pointer bg-white/40 border border-white/60 hover:bg-white/90 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-[#5c54a4]/20 transition-all duration-300 group"
                onClick={() => handleNodeSelect(nodeType)}
              >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-b from-[#f4f3fb] to-[#e8e9f5] border border-white shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0">
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
                  <div className="flex flex-col items-start text-left">
                    <span className="font-semibold text-sm text-gray-900 group-hover:text-[#5c54a4] transition-colors">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-gray-500 leading-tight mt-0.5">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mx-6 my-2 h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        <div className="px-6 pt-2 pb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 px-1">Actions</h3>
          {executionNodes.map((nodeType) => {
            const Icon = nodeType.icon;

            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto p-4 mb-3 rounded-xl cursor-pointer bg-white/40 border border-white/60 hover:bg-white/90 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-[#5c54a4]/20 transition-all duration-300 group"
                onClick={() => handleNodeSelect(nodeType)}
              >
                <div className="flex items-center gap-4 w-full overflow-hidden">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-b from-[#f4f3fb] to-[#e8e9f5] border border-white shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0">
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
                  <div className="flex flex-col items-start text-left">
                    <span className="font-semibold text-sm text-gray-900 group-hover:text-[#5c54a4] transition-colors">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-gray-500 leading-tight mt-0.5">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
