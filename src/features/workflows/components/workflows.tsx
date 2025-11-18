'use client'
import { EntityContainer, EntityHeaders, EntityPagination, EntitySearch } from '@/components/entity-components';
import { useCreateWorkflow, useSuspenseWorkflows } from '../hooks/use-workflows'
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import { useRouter } from 'next/navigation';
import { useWorkflowsParams } from '../hooks/use-workflows-params';
import { useEntitySearch } from '@/hooks/use-entity-search';

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
      header={<WorkFlowHeader />}
      search={<WorkflowSearch />}
      pagination={<WorkflowPagination />}
    >
      {children}
    </EntityContainer>
  )
}

export const WorkflowSearch =()=>{
  const [ params, setParams]= useWorkflowsParams();

  const { searchValues, onSearchChange }= useEntitySearch({
    params,
    setParams
  })

  return (
    <EntitySearch 
      onChange={onSearchChange}
      value={searchValues}
      placeholder='Search Workflows'
    />
  )
}

export const WorkflowPagination=()=>{
  const workflows= useSuspenseWorkflows();
  const [ params, setParams]= useWorkflowsParams()

  return(
    <EntityPagination
      onPageChange={(page)=> setParams({...params, page})}
      disable={workflows.isFetching}
      totalPages={workflows.data.totalPages}
      page={workflows.data.page}
    />
  )
}