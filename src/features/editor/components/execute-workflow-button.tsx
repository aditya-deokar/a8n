"use client";

import { Button } from "@/components/ui/button";
import { useExecuteWorkflow } from "@/features/workflows/hooks/use-workflows";
import { useSetAtom } from "jotai";
import { nodeStatusesAtom } from "@/features/editor/hooks/use-node-statuses";
import { FlaskConicalIcon } from "lucide-react";

export const ExecuteWorkflowButton = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const executeWorkflow = useExecuteWorkflow();
  const setStatuses = useSetAtom(nodeStatusesAtom);

  const handleExecute = () => {
    // Clear the previous run's per-node statuses before dispatching.
    setStatuses({});
    executeWorkflow.mutate({ id: workflowId });
  };

  return (
    <Button size="lg" onClick={handleExecute} disabled={executeWorkflow.isPending}>
      <FlaskConicalIcon className="size-4" />
      Execute workflow
    </Button>
  );
};
