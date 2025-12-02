"use client"

import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'


const AddNodeButton = () => {
  return (
    <Button 
        onClick={()=>{}}
        size={"icon"}
        variant={"outline"}
        className='bg-background'
    >
        <PlusIcon />
    </Button>
  )
}

export default AddNodeButton