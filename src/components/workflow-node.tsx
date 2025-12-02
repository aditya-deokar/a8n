"use client"

import { NodeToolbar, Position } from "@xyflow/react";
import type { ReactNode } from "react"
import { Button } from "./ui/button";
import { Settings2Icon, Trash2Icon } from "lucide-react";


interface WorkflowNodeProps {
    children: ReactNode;
    showToolbar?: boolean;
    onDelete?: ()=> void;
    onSettings?: ()=> void;
    name?: string;
    description?: string;
}


const WorkflowNode = ({
    children,
    description,
    name,
    onDelete,
    onSettings,
    showToolbar= true,
}:WorkflowNodeProps) => {
  return (
    <>
        {showToolbar && (
            <NodeToolbar>
                <Button size={"sm"} variant={"ghost"} onClick={onSettings}>
                    <Settings2Icon className="size-4"/>
                </Button>

                <Button size={"sm"} variant={"ghost"} onClick={onDelete}>
                    <Trash2Icon className="size-4"/>
                </Button>
            </NodeToolbar>
        )}

        {children}
        
        {name && (
            <NodeToolbar
             position={Position.Bottom}
             isVisible
             className="max-w-[200px] text-center"
            >
                <p className="font-medium">
                    {name}
                </p>
                {description && (
                    <p className="text-muted-foreground truncate text-sm">
                        {description}
                    </p>
                )}

            </NodeToolbar>
        )}
    </>
  )
}

export default WorkflowNode