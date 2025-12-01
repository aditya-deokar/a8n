'use client'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useSuspenseWorkflow, useUpdateWorkflowName } from "@/features/workflows/hooks/use-workflows"
import { SaveIcon } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"


const EditorHeader = ({ workflowId }:{workflowId: string}) => {
  return (
    <header className='flex h-14 shrink-0 items-center gap-2 border-b px-4'>
        <SidebarTrigger />
        <div className="flex flex-row item-center justify-between gap-x-4 w-full">
            <EditorBreadcrumbs workflowId={workflowId}/>
            <EditorSaveButton workflowId={workflowId}/>
        </div>
    </header>
  )
}

export default EditorHeader


export const EditorSaveButton = ({ workflowId }:{workflowId: string}) => {
  return (
    <div className="ml-auto ">
        <Button size={"sm"} onClick={()=>{}} disabled={false}>
            <SaveIcon className="size-4"/>
            Save
        </Button>
    </div>
    )
}


export const EditorBreadcrumbs = ({ workflowId }:{workflowId: string}) => {
  return (
    <Breadcrumb >
        <BreadcrumbList>
            <BreadcrumbItem>
                <BreadcrumbLink asChild>
                    <Link href={"/workflows"} prefetch>Workflows</Link>
                </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator/>
            <EditorNameInut workflowId={workflowId}/>
        </BreadcrumbList>
    </Breadcrumb>
    )
}

export const EditorNameInut = ( {workflowId}: {workflowId: string})=>{
    const { data: workflow }= useSuspenseWorkflow(workflowId)
    const updateWorkflow = useUpdateWorkflowName()

    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(workflow.name)

    const inputRef = useRef<HTMLInputElement>(null)

    return(
        <BreadcrumbItem className="cursor-pointer hover:text-foreground transition-colors">
            {workflow.name}
        </BreadcrumbItem>
    )
}