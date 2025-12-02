"use client"

import { NodeSelector } from '@/components/node-selector'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'


const AddNodeButton = () => {

  const [selectorOpen, SetselectorOpen] = useState(false)

  return (
   <NodeSelector onOpenChange={SetselectorOpen} open={selectorOpen}>

     <Button 
        onClick={()=>{}}
        size={"icon"}
        variant={"outline"}
        className='bg-background'
    >
        <PlusIcon />
    </Button>
   </NodeSelector>
  )
}

export default AddNodeButton