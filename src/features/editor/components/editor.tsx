"use client";

import { useState, useCallback, useMemo } from 'react';
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
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";

import '@xyflow/react/dist/style.css';
import { nodeComponents } from '@/config/node-components';
import { AddNodeButton } from './add-node-button';
import { useSetAtom } from 'jotai';
import { editorAtom } from '../store/atoms';
import { NodeType } from '@/generated/prisma';
import { ExecuteWorkflowButton } from './execute-workflow-button';

export const EditorLoading = () => {
  return <LoadingView message="Loading editor..." />;
};

export const EditorError = () => {
  return <ErrorView message="Error loading editor" />;
};

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { 
    data: workflow
  } = useSuspenseWorkflow(workflowId);

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
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="#e2e4f0" />
        <Controls 
          className="!bg-white/70 !backdrop-blur-xl !border !border-white/50 !shadow-[0_8px_30px_rgb(0,0,0,0.04)] !rounded-2xl overflow-hidden [&>button]:!border-b-white/50 hover:[&>button]:!bg-white/90 transition-all" 
          showInteractive={false} 
        />
        <MiniMap 
          className="!bg-white/70 !backdrop-blur-xl !border !border-white/50 !shadow-[0_8px_30px_rgb(0,0,0,0.04)] !rounded-2xl overflow-hidden" 
          maskColor="rgba(246, 248, 251, 0.6)"
        />
        <Panel position="top-right">
          <div className="mt-16 mr-2">
            <AddNodeButton />
          </div>
        </Panel>
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
