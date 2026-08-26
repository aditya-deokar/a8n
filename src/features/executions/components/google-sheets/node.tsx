"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { useNodeStatusById } from "@/features/editor/hooks/use-node-statuses";
import { useGraphMutations } from "@/features/editor/hooks/use-graph-mutations";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { GoogleSheetsDialog, GoogleSheetsFormValues } from "./dialog";

type GoogleSheetsNodeData = {
  variableName?: string;
  credentialId?: string;
  spreadsheetId?: string;
  sheetName?: string;
  rowJson?: string;
};

type GoogleSheetsNodeType = Node<GoogleSheetsNodeData>;

export const GoogleSheetsNode = memo((props: NodeProps<GoogleSheetsNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { updateNodeData } = useGraphMutations();
  const nodeStatus = useNodeStatusById(props.id);

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: GoogleSheetsFormValues) => {
    updateNodeData(props.id, values);
  };

  const nodeData = props.data;
  const description = nodeData?.sheetName
    ? `Append row to: ${nodeData.sheetName}`
    : "Not configured";

  return (
    <>
      <GoogleSheetsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        nodeId={props.id}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/googlesheets.svg"
        name="Google Sheets"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

GoogleSheetsNode.displayName = "GoogleSheetsNode";
