"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useNodeStatusById } from "@/features/editor/hooks/use-node-statuses";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { OpenAiDialog, OpenAiFormValues } from "./dialog";

type OpenAiNodeData = {
  variableName?: string;
  credentialId?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

type OpenAiNodeType = Node<OpenAiNodeData>;

export const OpenAiNode = memo((props: NodeProps<OpenAiNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { updateNodeData } = useGraphMutations();
  const nodeStatus = useNodeStatusById(props.id);

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: OpenAiFormValues) => {
    updateNodeData(props.id, values);
  };

  const nodeData = props.data;
  const description = nodeData?.userPrompt
    ? `${nodeData.model ?? "gpt-4"}: ${nodeData.userPrompt.slice(0, 50)}...`
    : "Not configured";

  return (
    <>
      <OpenAiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/openai.svg"
        name="OpenAi"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  )
});

OpenAiNode.displayName = "OpenAiNode";
