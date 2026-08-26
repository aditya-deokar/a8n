"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  ReactFlow, 
  applyNodeChanges, 
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
} from '@xyflow/react';
import { ErrorView } from "@/components/entity-components";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";
import { useTheme } from "next-themes";
import { useSetAtom, useAtomValue, useAtom } from "jotai";

import '@xyflow/react/dist/style.css';
import { nodeComponents } from '@/config/node-components';
import { WorkflowEdge } from '@/components/react-flow/workflow-edge';
import {
  editorAtom,
  graphModeAtom,
  draftPreviewAtom,
  isCanvasDirtyAtom,
  editorNodesAtom,
  editorEdgesAtom,
  replaceGraphAtom,
  pushHistoryAtom,
  undoAtom,
  redoAtom,
  canUndoAtom,
  canRedoAtom,
  resetEditorStoreAtom,
} from '../store/atoms';
import { useGraphMutations } from '../hooks/use-graph-mutations';
import { RealtimeStatusProvider } from '../hooks/use-node-statuses';
import { NodeType } from '@/generated/prisma';
import type { Node, Edge } from '@xyflow/react';
import { ExecuteWorkflowButton } from './execute-workflow-button';
import { Button } from '@/components/ui/button';
import { CheckIcon, Undo2Icon, Redo2Icon } from 'lucide-react';

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

/** Normalized projection used to compare local vs server graphs. */
const serializeForCompare = (nodes: Node[], edges: Edge[]) =>
  JSON.stringify([
    nodes
      .map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges
      .map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? "main",
        targetHandle: e.targetHandle ?? "main",
      }))
      .sort(
        (a, b) =>
          `${a.source}>${a.target}`.localeCompare(`${b.source}>${b.target}`),
      ),
  ]);

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
};

const createNodeId = () => `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const edgeTypes = { workflow: WorkflowEdge };

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setEditor = useSetAtom(editorAtom);
  const setIsCanvasDirty = useSetAtom(isCanvasDirtyAtom);
  const setGraphMode = useSetAtom(graphModeAtom);
  const setDraftPreview = useSetAtom(draftPreviewAtom);
  const setNodesAtom = useSetAtom(editorNodesAtom);
  const setEdgesAtom = useSetAtom(editorEdgesAtom);
  const replaceGraph = useSetAtom(replaceGraphAtom);
  const pushHistory = useSetAtom(pushHistoryAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const resetEditorStore = useSetAtom(resetEditorStoreAtom);

  // Controlled state lives in jotai so that every component (canvas, node
  // dialogs, node selector, base nodes) mutates the same store.
  const [nodes] = useAtom(editorNodesAtom);
  const [edges] = useAtom(editorEdgesAtom);
  const { addNode, connectEdge, reconnectEdge } = useGraphMutations();
  const editorInstance = useAtomValue(editorAtom);

  const graphMode = useAtomValue(graphModeAtom);
  const draftPreview = useAtomValue(draftPreviewAtom);
  const isCanvasDirty = useAtomValue(isCanvasDirtyAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);

  const serverSignature = useMemo(
    () => serializeForCompare(workflow.nodes as Node[], workflow.edges as Edge[]),
    [workflow],
  );
  const localSignature = useMemo(
    () => serializeForCompare(nodes, edges),
    [nodes, edges],
  );

  // Hydrate / re-sync the canvas. While the user has unsaved changes we never
  // clobber local state (e.g. rename-triggered refetches); otherwise adopt the
  // server graph whenever it actually differs.
  useEffect(() => {
    if (graphMode === "draft" && draftPreview) {
      replaceGraph({
        nodes: (draftPreview.nodes || []) as Node[],
        edges: (draftPreview.edges || []) as Edge[],
      });
      return;
    }
    if (graphMode !== "live") return;
    if (isCanvasDirty) return;
    if (localSignature === serverSignature) return;
    replaceGraph({ nodes: workflow.nodes as Node[], edges: workflow.edges as Edge[] });
  }, [
    graphMode,
    draftPreview,
    isCanvasDirty,
    localSignature,
    serverSignature,
    workflow.nodes,
    workflow.edges,
    replaceGraph,
  ]);

  // Reset transient state when leaving the editor so it never leaks into the
  // next workflow.
  useEffect(() => {
    return () => {
      resetEditorStore();
    };
  }, [resetEditorStore]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isCanvasDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isCanvasDirty]);

  // Undo/redo keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isTextEntryTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodesAtom((current) => applyNodeChanges(changes, current));
      if (graphMode === "live" && changes.some(c => c.type !== 'select' && c.type !== 'dimensions')) {
        setIsCanvasDirty(true);
      }
    },
    [setNodesAtom, graphMode, setIsCanvasDirty],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdgesAtom((current) => applyEdgeChanges(changes, current));
      if (graphMode === "live" && changes.some(c => c.type !== 'select')) {
        setIsCanvasDirty(true);
      }
    },
    [setEdgesAtom, graphMode, setIsCanvasDirty],
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      connectEdge(connection);
    },
    [connectEdge],
  );

  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectEdge(oldEdge.id, newConnection);
    },
    [reconnectEdge],
  );

  // Drag-and-drop node creation from the node selector panel.
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/a8n-node");
      if (!nodeType) return;

      const flowPosition =
        editorInstance?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }) ?? { x: 0, y: 0 };

      addNode({
        id: createNodeId(),
        data: {},
        position: flowPosition,
        type: nodeType,
      });
    },
    [addNode, editorInstance],
  );

  const hasTrigger = useMemo(() => {
    const triggerTypes: NodeType[] = [
      NodeType.MANUAL_TRIGGER,
      NodeType.GOOGLE_FORM_TRIGGER,
      NodeType.STRIPE_TRIGGER,
    ];
    return nodes.some((node) => triggerTypes.includes(node.type as NodeType));
  }, [nodes]);

  return (
    <RealtimeStatusProvider>
    <div className='size-full relative'>
      {graphMode === "draft" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground pl-4 pr-2 py-2 rounded-full shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4">
          <span>Draft Preview Mode</span>
          <Button 
            size="sm" 
            variant="secondary" 
            className="h-6 text-xs rounded-full px-3"
            onClick={() => {
              setGraphMode("live");
              setDraftPreview(null);
            }}
          >
            Back to Live
          </Button>
        </div>
      )}
      {graphMode === "applied" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckIcon className="size-4" />
          <span>Changes Applied</span>
        </div>
      )}
      <ReactFlow
        colorMode={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeDragStart={onNodeDragStart}
        nodeTypes={nodeComponents}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "workflow" }}
        edgesReconnectable
        connectionRadius={30}
        onInit={setEditor}
        fitView
        snapGrid={[10, 10]}
        snapToGrid
        panOnScroll
        panOnDrag={false}
        selectionOnDrag
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color={mounted && resolvedTheme === 'dark' ? '#27272a' : '#e2e4f0'} />
        <Panel position="bottom-left">
          <div className="hidden md:flex items-center gap-1 mb-6 rounded-2xl border border-white/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-sm p-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={!canUndo}
              onClick={() => undo()}
              title="Undo (Ctrl+Z)"
            >
              <Undo2Icon className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={!canRedo}
              onClick={() => redo()}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2Icon className="size-4" />
            </Button>
          </div>
        </Panel>
        <Controls 
          className="hidden md:flex !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/50 dark:!border-zinc-800/50 !shadow-sm !rounded-2xl overflow-hidden [&>button]:!border-b-white/50 dark:[&>button]:!border-b-zinc-800/50 hover:[&>button]:!bg-white/90 dark:hover:[&>button]:!bg-zinc-800/90 transition-all [&>button]:dark:!bg-zinc-900/50 [&>button>svg]:dark:!fill-zinc-400" 
          showInteractive={false} 
        />
        <MiniMap 
          className="hidden md:block !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/50 dark:!border-zinc-800/50 !shadow-sm !rounded-2xl overflow-hidden" 
          maskColor={mounted && resolvedTheme === 'dark' ? "rgba(24, 24, 27, 0.6)" : "rgba(246, 248, 251, 0.6)"}
        />

        {hasTrigger && (
          <Panel position="bottom-center">
            <div className="mb-6">
              <ExecuteWorkflowButton workflowId={workflowId} />
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
    </RealtimeStatusProvider>
  );
};
