"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useNodeStatusById } from "@/features/editor/hooks/use-node-statuses";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { EmailDialog, EmailFormValues } from "./dialog";

type EmailNodeData = {
  variableName?: string;
  credentialId?: string;
  to?: string;
  subject?: string;
  body?: string;
  from?: string;
  replyTo?: string;
};

type EmailNodeType = Node<EmailNodeData>;

export const EmailNode = memo((props: NodeProps<EmailNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { updateNodeData } = useGraphMutations();
  const nodeStatus = useNodeStatusById(props.id);

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: EmailFormValues) => {
    updateNodeData(props.id, values);
  };

  const nodeData = props.data;
  const description = nodeData?.to
    ? `Send to: ${nodeData.to.slice(0, 50)}...`
    : "Not configured";

  return (
    <>
      <EmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/email.svg"
        name="Email"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

EmailNode.displayName = "EmailNode";
