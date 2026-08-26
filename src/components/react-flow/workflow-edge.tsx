"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { PlusIcon, XIcon } from "lucide-react";
import { useSetAtom } from "jotai";
import {
  nodeSelectorOpenAtom,
  pendingEdgeInsertAtom,
} from "@/features/editor/store/atoms";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const setSelectorOpen = useSetAtom(nodeSelectorOpenAtom);
  const setPendingEdgeInsert = useSetAtom(pendingEdgeInsertAtom);
  const { deleteEdge } = useGraphMutations();

  return (
    <>
      <BaseEdge id={id} path={path} />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="pointer-events-auto absolute z-10 flex items-center gap-1 nodrag nopan"
        >
          {(selected ?? false) && (
            <>
              <button
                type="button"
                title="Insert node here"
                onClick={(event) => {
                  event.stopPropagation();
                  setPendingEdgeInsert(id);
                  setSelectorOpen(true);
                }}
                className="size-5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:bg-[#5c54a4] hover:text-white hover:border-[#5c54a4] transition-colors"
              >
                <PlusIcon className="size-3" />
              </button>
              <button
                type="button"
                title="Delete connection"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteEdge(id);
                }}
                className="size-5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
              >
                <XIcon className="size-3" />
              </button>
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

WorkflowEdge.displayName = "WorkflowEdge";
