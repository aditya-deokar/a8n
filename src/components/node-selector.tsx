"use client";

import { useReactFlow } from "@xyflow/react";
import {
  GlobeIcon,
  MailIcon,
  MousePointerIcon,
  SearchIcon,
  TableIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  editorNodesAtom,
  nodeSelectorOpenAtom,
  pendingEdgeInsertAtom,
} from "@/features/editor/store/atoms";
import { NodeType } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { NODE_MANIFESTS } from "@/features/workflows/node-manifest";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";

export type NodeTypeOption = {
  type: NodeType;
  label: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }> | string;
};

const nodeIcons: Partial<Record<NodeType, NodeTypeOption["icon"]>> = {
  [NodeType.MANUAL_TRIGGER]: MousePointerIcon,
  [NodeType.GOOGLE_FORM_TRIGGER]: "/logos/googleform.svg",
  [NodeType.STRIPE_TRIGGER]: "/logos/stripe.svg",
  [NodeType.HTTP_REQUEST]: GlobeIcon,
  [NodeType.GEMINI]: "/logos/gemini.svg",
  [NodeType.OPENAI]: "/logos/openai.svg",
  [NodeType.ANTHROPIC]: "/logos/anthropic.svg",
  [NodeType.DISCORD]: "/logos/discord.svg",
  [NodeType.SLACK]: "/logos/slack.svg",
  [NodeType.EMAIL]: MailIcon,
  [NodeType.GOOGLE_SHEETS]: TableIcon,
};

const nodeOptions: NodeTypeOption[] = NODE_MANIFESTS.filter(
  (node) => node.type !== NodeType.INITIAL,
).map((node) => ({
  type: node.type,
  label: node.label,
  description: node.beginnerDescription,
  keywords: [...node.aliases, node.category],
  icon: nodeIcons[node.type] || GlobeIcon,
}));

const triggerNodeTypes = new Set<NodeType>([
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
]);

const triggerNodes = nodeOptions.filter((node) => triggerNodeTypes.has(node.type));

const executionNodes = nodeOptions.filter(
  (node) => !triggerNodeTypes.has(node.type),
);

function filterOptions(options: NodeTypeOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(q) ||
      option.description.toLowerCase().includes(q) ||
      option.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
  );
}

export function NodeSelector() {
  const { screenToFlowPosition } = useReactFlow();
  const [open, setOpen] = useAtom(nodeSelectorOpenAtom);
  const pendingEdgeId = useAtomValue(pendingEdgeInsertAtom);
  const setPendingEdgeInsert = useSetAtom(pendingEdgeInsertAtom);
  const nodes = useAtomValue(editorNodesAtom);
  const { addNode, insertNodeOnEdge } = useGraphMutations();
  const [search, setSearch] = useState("");

  const filteredTriggers = useMemo(
    () => filterOptions(triggerNodes, search),
    [search],
  );
  const filteredActions = useMemo(
    () => filterOptions(executionNodes, search),
    [search],
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    setSearch("");
    setPendingEdgeInsert(null);
  }, [setOpen, setPendingEdgeInsert]);

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      if (
        selection.type === NodeType.MANUAL_TRIGGER &&
        !pendingEdgeId &&
        nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER)
      ) {
        toast.error("Only one manual trigger is allowed per workflow");
        return;
      }

      if (pendingEdgeId) {
        insertNodeOnEdge(pendingEdgeId, {
          id: createId(),
          data: {},
          position: { x: 0, y: 0 },
          type: selection.type,
        });
      } else {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        addNode({
          id: createId(),
          data: {},
          position: screenToFlowPosition({
            x: centerX + (Math.random() - 0.5) * 120,
            y: centerY + (Math.random() - 0.5) * 120,
          }),
          type: selection.type,
        });
      }

      closePanel();
    },
    [
      addNode,
      insertNodeOnEdge,
      closePanel,
      pendingEdgeId,
      nodes,
      screenToFlowPosition,
    ],
  );

  const handleDragStart = (
    event: React.DragEvent,
    selection: NodeTypeOption,
  ) => {
    event.dataTransfer.setData("application/a8n-node", selection.type);
    event.dataTransfer.effectAllowed = "move";
    setOpen(false);
  };

  const renderNodeCard = (nodeType: NodeTypeOption) => {
    const Icon = nodeType.icon;

    return (
      <div
        key={nodeType.type}
        draggable
        onDragStart={(event) => handleDragStart(event, nodeType)}
        className="w-full justify-start h-auto p-4 mb-3 rounded-xl cursor-pointer bg-white/40 dark:bg-zinc-900/50 border border-transparent hover:bg-white dark:hover:bg-zinc-800 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[#5c54a4]/30 dark:hover:border-[#5c54a4]/50 transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
        onClick={() => handleNodeSelect(nodeType)}
      >
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center justify-center size-10 rounded-lg bg-[#f4f3fb] dark:bg-[#5c54a4]/20 border border-white/50 dark:border-zinc-700/50 shadow-sm group-hover:scale-110 transition-transform duration-300 shrink-0">
            {typeof Icon === "string" ? (
              <img
                src={Icon}
                alt={nodeType.label}
                className="size-5 object-contain"
              />
            ) : (
              <Icon className="size-5 text-[#5c54a4] dark:text-[#7972b9]" />
            )}
          </div>
          <div className="flex flex-col items-start text-left flex-1 min-w-0">
            <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 group-hover:text-[#5c54a4] dark:group-hover:text-[#7972b9] transition-colors truncate w-full">
              {nodeType.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5 line-clamp-2 w-full">
              {nodeType.description}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "absolute top-4 right-4 h-[calc(100%-2rem)] w-[340px] z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right",
        open
          ? "translate-x-0 scale-100 opacity-100 pointer-events-auto"
          : "translate-x-[110%] scale-95 opacity-0 pointer-events-none"
      )}
    >
      <div className={cn(
        "w-full h-full shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col transition-all duration-500 rounded-2xl border",
        open
          ? "bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl border-white/50 dark:border-zinc-700/50 pt-2 relative z-0"
          : "bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl border-white/20 dark:border-zinc-800/30 relative z-0"
      )}>
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 leading-tight">
              {pendingEdgeId ? "Insert a step" : "Triggers & Actions"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {pendingEdgeId
                ? "The new step will be connected between the two nodes."
                : "Click to add, or drag onto the canvas."}
            </p>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close panel"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="px-6 pb-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search nodes..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/70 dark:bg-zinc-900/70 border border-gray-200 dark:border-zinc-700 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-[#5c54a4]/30 focus:border-[#5c54a4] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 mt-1">
          {filteredTriggers.length === 0 && filteredActions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">
              No nodes match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <>
              {filteredTriggers.length > 0 && (
                <div className="pb-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4 px-1">Triggers</h3>
                  {filteredTriggers.map(renderNodeCard)}
                </div>
              )}
              {filteredTriggers.length > 0 && filteredActions.length > 0 && (
                <div className="mx-1 my-4 h-[1px] bg-gradient-to-r from-transparent via-gray-200 dark:via-zinc-800 to-transparent" />
              )}
              {filteredActions.length > 0 && (
                <div className="pt-2 pb-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-4 px-1">Actions</h3>
                  {filteredActions.map(renderNodeCard)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
