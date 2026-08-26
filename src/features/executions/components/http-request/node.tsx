"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useNodeStatusById } from "@/features/editor/hooks/use-node-statuses";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";
import { GlobeIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { HttpRequestFormValues, HttpRequestDialog } from "./dialog";

type HttpRequestNodeData = {
  variableName?: string;
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
};

type HttpRequestNodeType = Node<HttpRequestNodeData>;

export const HttpRequestNode = memo((props: NodeProps<HttpRequestNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { updateNodeData } = useGraphMutations();
  const nodeStatus = useNodeStatusById(props.id);

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: HttpRequestFormValues) => {
    updateNodeData(props.id, values);
  };

  const nodeData = props.data;
  const description = nodeData?.endpoint
    ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
    : "Not configured";

  return (
    <>
      <HttpRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={GlobeIcon}
        name="HTTP Request"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  )
});

HttpRequestNode.displayName = "HttpRequestNode";
