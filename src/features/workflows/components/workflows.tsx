"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  EmptyView,
  EntityContainer, 
  EntityHeader, 
  EntityItem, 
  EntityList, 
  EntityPagination, 
  EntitySearch,
  ErrorView,
  LoadingView
} from "@/components/entity-components";
import {
  useCreateWorkflow,
  useRemoveWorkflow,
  useSetActiveWorkflow,
  useSuspenseWorkflows,
} from "../hooks/use-workflows"
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { useRouter } from "next/navigation";
import { useWorkflowsParams } from "../hooks/use-workflows-params";
import { useEntitySearch } from "@/hooks/use-entity-search";
import type { Workflow } from "@/generated/prisma";
import { WorkflowIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const WorkflowsSearch = () => {
  const [params, setParams] = useWorkflowsParams();
  const { searchValue, onSearchChange } = useEntitySearch({
    params,
    setParams,
  });

  return (
    <EntitySearch
      value={searchValue}
      onChange={onSearchChange}
      placeholder="Search workflows"
    />
  );
};

export const WorkflowsList = () => {
  const workflows = useSuspenseWorkflows();

  return (
    <EntityList
      items={workflows.data.items}
      getKey={(workflow) => workflow.id}
      renderItem={(workflow) => <WorkflowItem data={workflow} />}
      emptyView={<WorkflowsEmpty />}
    />
  )
};

export const WorkflowsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();
  const createWorkflow = useCreateWorkflow();
  const { handleError, modal } = useUpgradeModal();

  const handleCreate = () => {
    createWorkflow.mutate(undefined, {
      onSuccess: (data) => {
        router.push(`/workflows/${data.id}`);
      },
      onError: (error) => {
        handleError(error);
      },
    });
  }

  return (
    <>
      {modal}
      <EntityHeader
        title="Workflows"
        description="Create and manage your workflows"
        onNew={handleCreate}
        newButtonLabel="New workflow"
        disabled={disabled}
        isCreating={createWorkflow.isPending}
      />
    </>
  );
};

export const WorkflowsPagination = () => {
  const workflows = useSuspenseWorkflows();
  const [params, setParams] = useWorkflowsParams();

  return (
    <EntityPagination
      disabled={workflows.isFetching}
      totalPages={workflows.data.totalPages}
      page={workflows.data.page}
      onPageChange={(page) => setParams({ ...params, page })}
    />
  );
};

export const WorkflowsContainer = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return (
    <EntityContainer
      header={<WorkflowsHeader />}
      search={<WorkflowsSearch />}
      pagination={<WorkflowsPagination />}
    >
      {children}
    </EntityContainer>
  );
};

export const WorkflowsLoading = () => {
  return <LoadingView message="Loading workflows..." />;
};

export const WorkflowsError = () => {
  return <ErrorView message="Error loading workflows" />;
};

export const WorkflowsEmpty = () => {
  const router = useRouter();
  const createWorkflow = useCreateWorkflow();
  const { handleError, modal } = useUpgradeModal();

  const handleCreate = () => {
    createWorkflow.mutate(undefined, {
      onError: (error) => {
        handleError(error);
      },
      onSuccess: (data) => {
        router.push(`/workflows/${data.id}`);
      }
    });
  };

  return (
    <>
      {modal}
      <EmptyView
        onNew={handleCreate}
        message="You haven't created any workflows yet. Get started by creating your first workflow"
      />
    </>
  );
};

export const WorkflowItem = ({
  data,
}: { 
  data: Workflow
}) => {
  const removeWorkflow = useRemoveWorkflow();
  const setActiveWorkflow = useSetActiveWorkflow();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRemove = () => {
    // Deletion is destructive and irreversible — require explicit confirmation.
    setConfirmOpen(true);
  }

  return (
    <>
      <EntityItem
        href={`/workflows/${data.id}`}
        title={data.name}
        subtitle={
          <>
            Updated {formatDistanceToNow(data.updatedAt, { addSuffix: true })}{" "}
            &bull; Created{" "}
            {formatDistanceToNow(data.createdAt, { addSuffix: true })}
          </>
        }
        image={
          <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#e8e9f5] to-[#f4f3fb] dark:from-indigo-950/50 dark:to-indigo-900/50 flex items-center justify-center flex-shrink-0 border border-white dark:border-indigo-900/50 shadow-inner">
            <WorkflowIcon className="size-5 sm:size-6 text-[#5c54a4] dark:text-indigo-400" />
          </div>
        }
        onRemove={handleRemove}
        isRemoving={removeWorkflow.isPending}
        actions={
          <div
            className="flex items-center gap-2"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <Badge
              variant={data.active ? "default" : "outline"}
              className={
                data.active
                  ? "bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30"
                  : "text-gray-500 dark:text-zinc-400"
              }
            >
              {data.active ? "Active" : "Draft"}
            </Badge>
            <Switch
              checked={data.active}
              disabled={setActiveWorkflow.isPending}
              onCheckedChange={(active) =>
                setActiveWorkflow.mutate({ id: data.id, active })
              }
              title={data.active ? "Deactivate workflow" : "Activate workflow"}
            />
          </div>
        }
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &ldquo;{data.name}&rdquo; together with
              all of its nodes, connections and execution history. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(event) => {
                event.preventDefault();
                setConfirmOpen(false);
                removeWorkflow.mutate({ id: data.id });
              }}
            >
              Delete workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}