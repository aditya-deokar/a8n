'use client'
import { ErrorView, LoadingView } from "@/components/entity-components";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows"


const Editor = ({ workflowId }: { workflowId: string }) => {

    const { data: workflow } = useSuspenseWorkflow(workflowId);

  return (
    <div>{JSON.stringify(workflow, null, 2)}</div>
  )
}

export default Editor

export const EditorLoading =()=>{
    return (
        <LoadingView message="Loading editor..."/>
    )
} 
export const EditorError =()=>{
    return (
        <ErrorView message="Error Loading editor..."/>
    )
} 