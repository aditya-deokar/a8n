"use client"

import { NodeProps, Position } from '@xyflow/react'
import {type LucideIcon } from 'lucide-react'
import  { type ReactNode } from 'react'
import WorkflowNode from '../../../components/workflow-node';
import { BaseNode, BaseNodeContent } from '../../../components/react-flow/base-node';
import Image from 'next/image';
import { BaseHandle } from '../../../components/react-flow/base-handle';

interface BaseTriggerNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    // status?:NodeStatus;
    onSettings?: ()=> void;
    onDoubleClick?: ()=> void;
}

const BaseTriggerNode = ({
    icon: Icon,
    id,
    name,
    description,
    children,
    onSettings,
    onDoubleClick
}: BaseTriggerNodeProps) => {

    const handleDelete= ()=>{};

  return (
    <WorkflowNode
        name={name}
        description={description}
        onDelete={handleDelete}
        onSettings={onSettings}
    >
        <BaseNode onDoubleClick={onDoubleClick} className='rounded-2xl relative group'>
            <BaseNodeContent>
                {typeof Icon === "string" ? (
                    <Image src={Icon} alt={name} width={16}  height={16}/>
                ): (
                    <Icon className='size-4 text-muted-foreground'/>
                )}
                {children}

                <BaseHandle 
                    id="source-1"
                    type="source"
                    position={Position.Right}
                />
            </BaseNodeContent>
        
        </BaseNode>
    </WorkflowNode>
  )
}

export default BaseTriggerNode