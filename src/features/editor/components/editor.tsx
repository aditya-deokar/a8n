"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
} from '@xyflow/react';
import { ErrorView, LoadingView } from "@/components/entity-components";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";
import { useTheme } from "next-themes";

import '@xyflow/react/dist/style.css';
import { nodeComponents } from '@/config/node-components';
import { useSetAtom } from 'jotai';
import { editorAtom } from '../store/atoms';
import { NodeType } from '@/generated/prisma';
import { ExecuteWorkflowButton } from './execute-workflow-button';

export const EditorLoading = () => {
  return (
    <div className="flex flex-col h-full w-full gap-2 overflow-hidden min-h-0">
      <div className="flex items-stretch gap-2 shrink-0">
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0 h-[88px]">
          <Skeleton className="size-10 rounded-xl dark:bg-zinc-800" />
        </div>
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex-1 flex items-center px-8 h-[88px]">
          <div className="flex flex-row items-center justify-between gap-x-4 w-full">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-md dark:bg-zinc-800" />
              <Skeleton className="size-4 rounded-sm dark:bg-zinc-800" />
              <Skeleton className="h-8 w-32 rounded-lg dark:bg-zinc-800" />
            </div>
            <Skeleton className="h-9 w-32 rounded-xl dark:bg-zinc-800" />
          </div>
        </div>
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0 h-[88px]">
          <Skeleton className="size-10 rounded-xl dark:bg-zinc-800" />
        </div>
      </div>
      <div className="flex-1 flex flex-row w-full overflow-hidden min-h-0 gap-2">
        <main className="relative flex-1 h-full flex flex-col bg-[#f6f8fb] dark:bg-[#18181b] rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden min-w-0 min-h-0">
          <div className="flex-1 w-full h-full flex items-center justify-center relative">
            <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-6 flex justify-between pointer-events-none">
              <Skeleton className="h-[200px] w-12 rounded-2xl dark:bg-zinc-800" />
              <Skeleton className="h-[150px] w-48 rounded-2xl absolute bottom-0 right-0 dark:bg-zinc-800" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export const EditorError = () => {
  return <ErrorView message="Error loading editor" />;
};

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { 
    data: workflow
  } = useSuspenseWorkflow(workflowId);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setEditor = useSetAtom(editorAtom);

  const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const hasManualTrigger = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
  }, [nodes]);

  return (
    <div className='size-full'>
      <ReactFlow
        colorMode={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeComponents}
        onInit={setEditor}
        fitView
        snapGrid={[10, 10]}
        snapToGrid
        panOnScroll
        panOnDrag={false}
        selectionOnDrag
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color={mounted && resolvedTheme === 'dark' ? '#27272a' : '#e2e4f0'} />
        <Controls 
          className="!bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/50 dark:!border-zinc-800/50 !shadow-sm !rounded-2xl overflow-hidden [&>button]:!border-b-white/50 dark:[&>button]:!border-b-zinc-800/50 hover:[&>button]:!bg-white/90 dark:hover:[&>button]:!bg-zinc-800/90 transition-all [&>button]:dark:!bg-zinc-900/50 [&>button>svg]:dark:!fill-zinc-400" 
          showInteractive={false} 
        />
        <MiniMap 
          className="!bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/50 dark:!border-zinc-800/50 !shadow-sm !rounded-2xl overflow-hidden" 
          maskColor={mounted && resolvedTheme === 'dark' ? "rgba(24, 24, 27, 0.6)" : "rgba(246, 248, 251, 0.6)"}
        />

        {hasManualTrigger && (
          <Panel position="bottom-center">
            <div className="mb-6">
              <ExecuteWorkflowButton workflowId={workflowId} />
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};
