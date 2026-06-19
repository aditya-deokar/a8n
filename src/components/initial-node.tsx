"use client";

import type { NodeProps } from "@xyflow/react";
import { PlusIcon } from "lucide-react";
import { memo } from "react";
import { useSetAtom } from "jotai";
import { nodeSelectorOpenAtom } from "@/features/editor/store/atoms";
import { PlaceholderNode } from "./react-flow/placeholder-node";
import { WorkflowNode } from "./workflow-node";

export const InitialNode = memo((props: NodeProps) => {
  const setSelectorOpen = useSetAtom(nodeSelectorOpenAtom);

  return (
    <WorkflowNode showToolbar={false}>
      <PlaceholderNode
        {...props}
        onClick={() => setSelectorOpen(true)}
      >
        <div className="cursor-pointer flex items-center justify-center">
          <PlusIcon className="size-4" />
        </div>
      </PlaceholderNode>
    </WorkflowNode>
  )
});

InitialNode.displayName = "InitialNode";