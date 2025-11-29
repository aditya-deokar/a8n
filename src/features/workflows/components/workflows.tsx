'use client'
import { EmptyView, EntityContainer, EntityHeaders, EntityItem, EntityList, EntityPagination, EntitySearch, ErrorView, LoadingView } from '@/components/entity-components';
import { useCreateWorkflow, useRemoveWorkflow, useSuspenseWorkflows } from '../hooks/use-workflows'
import { useUpgradeModal } from '@/hooks/use-upgrade-modal';
import { useRouter } from 'next/navigation';
import { useWorkflowsParams } from '../hooks/use-workflows-params';
import { useEntitySearch } from '@/hooks/use-entity-search';
import type { Workflow } from '@/generated/prisma/client';
import { WorkflowIcon } from 'lucide-react';
import { formatDistanceToNow } from "date-fns"

const Workflows = () => {
  const workflows =useSuspenseWorkflows();

  
  return (
    <EntityList item={workflows.data.items}
    getKey={(workflow)=> workflow.id}
    renderItem={(workflow)=> <WorkflowItem data={workflow}/>}
    emptyView={<WorkflowEmpty />}

    />
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


export const WorkflowLoading =()=>{
  return (
    <LoadingView  message='Loading Workflows...'/>
  )
}

export const WorkflowError =()=>{
  return (
    <ErrorView message='Workflow Error..'/>
  )
}


export const WorkflowEmpty =() =>{
  const createWorkflow = useCreateWorkflow();
  const { handleError, modal } = useUpgradeModal();
  const router= useRouter();

  const handleCreate =()=>{
    createWorkflow.mutate(undefined, {
      onError:(error)=>{
        handleError(error);
      },
      onSuccess :(data)=> {
        router.push(`/workflows/${data.id}`)
      }
    })
  }


  return (
    <>
    {modal}
      <EmptyView onNew={handleCreate} message='You workflows found. Get started by creating your first workflow '/>
    </>
  )
}


export const WorkflowItem =({ data }: {data: Workflow})=>{

  const removeWorkflow = useRemoveWorkflow();

  const handleRemove =()=>{
    removeWorkflow.mutate({ id: data.id })
  }

  return(
    <EntityItem
      href={`/workflows/${data.id}`}
      title={data.name}
      subtitle={
        <>
          updated {formatDistanceToNow(data.updatedAt, {addSuffix:true})} {" "}
          &bull; Created{" "} {formatDistanceToNow(data.createdAt, {addSuffix:true} )}  
        </>
      }
      image={
        <div className='size-8 flex items-center justify-center'>
          <WorkflowIcon className='size-5 text-muted-foreground'/>
        </div>
      }
      onRemove={handleRemove}
      isRemoving={removeWorkflow.isPending}
    >

    </EntityItem>
  )

}