'use client'
import { EntityContainer, EntityHeaders } from '@/components/entity-components';
import { useCreateWorkflow, useSuspenseWorkflows } from '../hooks/use-workflows'
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import { useRouter } from 'next/navigation';

const Workflows = () => {
    const workflows =useSuspenseWorkflows();


  return (
    <div>{JSON.stringify(workflows)}</div>
  )
}

export default Workflows

export const WorkFlowHeader= ({ disable }: { disable?: boolean})=>{

  const createWorkflow = useCreateWorkflow();
  const { handleError ,modal }= useUpgradeModal();
  const router= useRouter();

  const handleCreate= ()=>{
    createWorkflow.mutate(undefined, {

      onSuccess:(data)=>{
        router.push(`/workflows/${data.id}`)
      },
      
      onError:(error)=>{
        // Open upgrade model
        // console.error(error);
        handleError(error);
      }    
    })
  }
  return(
    <>
    {modal}
      <EntityHeaders
        title='Workflows'
        description='Create and manage your workflows'
        onNew={handleCreate}
        newButtonLabel="New workflow"
        disable={disable}
        isCreating={createWorkflow.isPending}
      />
    </>
  )
}


export const WorkflowContainer =({children}: { children: React.ReactNode})=>{
  return(
    <EntityContainer
      header={<WorkFlowHeader/>}
      search={<></>}
      pagination={<></>}
    >
      {children}
    </EntityContainer>
  )
}