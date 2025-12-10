import { NodeProps } from '@xyflow/react'
import BaseTriggerNode from '../base-trigger-node'
import { MousePointerIcon } from 'lucide-react'
import ManualTriggerDialog from './dialog'
import { useState } from 'react'


const ManualTriggerNode = (props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const nodeStatus="loading"

  const handleOpenSettings =() => setDialogOpen(true);

  return (
    <>
        <ManualTriggerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        <BaseTriggerNode
         {...props}
            icon={MousePointerIcon}
            name= "When clicking 'Execute workflow'"
            status={nodeStatus}
            onSettings= {handleOpenSettings}
            onDoubleClick={handleOpenSettings}
        
        />
    </>
  )
}

export default ManualTriggerNode