"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { GoogleSheetsDialog, GoogleSheetsFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchGoogleSheetsRealtimeToken } from "./actions";
import { GOOGLE_SHEETS_CHANNEL_NAME } from "@/inngest/channels/google-sheets";

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
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: GOOGLE_SHEETS_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchGoogleSheetsRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: GoogleSheetsFormValues) => {
    setNodes((nodes) => nodes.map((node) => {
      if (node.id === props.id) {
        return {
          ...node,
          data: {
            ...node.data,
            ...values,
          },
        };
      }
      return node;
    }));
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
