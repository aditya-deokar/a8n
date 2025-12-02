"use client"

import { NodeProps } from '@xyflow/react'
import { PlaceholderNode } from './react-flow/placeholder-node'
import { PlusIcon } from 'lucide-react'
import WorkflowNode from './workflow-node'
import { NodeSelector } from './node-selector'
import { useState } from 'react'

const InitialNode = (props: NodeProps) => {
  const [selectorOpen, SetselectorOpen] = useState(false)
 
   return (
    <NodeSelector onOpenChange={SetselectorOpen} open={selectorOpen}>

      <WorkflowNode >
         <PlaceholderNode
            {...props}
            onClick={ ()=> SetselectorOpen(true) }
            >
                <div className='cursor-pointer flex items-center justify-center'>
                    <PlusIcon className='size-4'/>
                </div>
        </PlaceholderNode>
    </WorkflowNode>
    </NodeSelector>
  )
}

export default InitialNode