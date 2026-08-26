"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useNodeStatusById } from "@/features/editor/hooks/use-node-statuses";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { GeminiDialog, GeminiFormValues } from "./dialog";

type GeminiNodeData = {
  variableName?: string;
  credentialId?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

type GeminiNodeType = Node<GeminiNodeData>;

export const GeminiNode = memo((props: NodeProps<GeminiNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { updateNodeData } = useGraphMutations();
  const nodeStatus = useNodeStatusById(props.id);

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: GeminiFormValues) => {
    updateNodeData(props.id, values);
  };

  const nodeData = props.data;
  const description = nodeData?.userPrompt
    ? `${nodeData.model ?? "gemini-3-flash-preview"}: ${nodeData.userPrompt.slice(0, 50)}...`
    : "Not configured";

  return (
    <>
      <GeminiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/gemini.svg"
        name="Gemini"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  )
});

GeminiNode.displayName = "GeminiNode";
