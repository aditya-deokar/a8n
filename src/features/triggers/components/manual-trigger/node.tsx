import { NodeProps } from '@xyflow/react'
import BaseTriggerNode from '../base-trigger-node'
import { MousePointerIcon } from 'lucide-react'


const ManualTriggerNode = (props: NodeProps) => {
  return (
    <>
        <BaseTriggerNode
         {...props}
            icon={MousePointerIcon}
            name= "When clicking 'Execute workflow'"
            //  status={nodeStatus}
            onSettings= {()=>{}}
            onDoubleClick={()=> {}}
        
        />
    </>
  )
}

export default ManualTriggerNode