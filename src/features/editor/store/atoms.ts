import type { ReactFlowInstance, Node, Edge } from "@xyflow/react";
import { atom } from "jotai";

export const editorAtom = atom<ReactFlowInstance | null>(null);
export const nodeSelectorOpenAtom = atom<boolean>(false);

// Agent / Editor state
export const isAgentSidebarOpenAtom = atom<boolean>(false);
export type GraphMode = "live" | "draft" | "applied";
export const graphModeAtom = atom<GraphMode>("live");
export const isCanvasDirtyAtom = atom<boolean>(false);
export type DraftPreview = { nodes?: Node[]; edges?: Edge[] } | null;
export const draftPreviewAtom = atom<DraftPreview>(null);

// ─── Single source of truth for the canvas graph ────────────────────────────
// All mutations MUST go through applyGraphChangeAtom (or the useGraphMutations
// hook) so that dirty tracking, undo history and React Flow's controlled state
// stay in sync. Never call useReactFlow().setNodes/setEdges to mutate content.

export type GraphSnapshot = { nodes: Node[]; edges: Edge[] };

export const editorNodesAtom = atom<Node[]>([]);
export const editorEdgesAtom = atom<Edge[]>([]);

const HISTORY_LIMIT = 50;

export const historyPastAtom = atom<GraphSnapshot[]>([]);
export const historyFutureAtom = atom<GraphSnapshot[]>([]);

export const canUndoAtom = atom((get) => get(historyPastAtom).length > 0);
export const canRedoAtom = atom((get) => get(historyFutureAtom).length > 0);

// When set, picking a node in the selector splits this edge instead of
// appending a free-floating node.
export const pendingEdgeInsertAtom = atom<string | null>(null);

type GraphMutator = (snapshot: GraphSnapshot) => GraphSnapshot;

// Applies a graph mutation: pushes an undo entry, marks the canvas dirty and
// writes the new nodes/edges. Runs against the live store so it never sees a
// stale closure.
export const applyGraphChangeAtom = atom(
  null,
  (get, set, mutate: GraphMutator) => {
    const current: GraphSnapshot = {
      nodes: get(editorNodesAtom),
      edges: get(editorEdgesAtom),
    };
    const next = mutate(current);
    if (next === current) return;

    if (get(graphModeAtom) === "live") {
      const past = get(historyPastAtom);
      set(historyPastAtom, [...past.slice(-(HISTORY_LIMIT - 1)), current]);
      set(historyFutureAtom, []);
      set(isCanvasDirtyAtom, true);
    }
    set(editorNodesAtom, next.nodes);
    set(editorEdgesAtom, next.edges);
  },
);

// Records an undo point for changes that happen outside applyGraphChangeAtom
// (e.g. capturing the pre-drag snapshot when the user starts dragging a node).
export const pushHistoryAtom = atom(null, (get, set) => {
  if (get(graphModeAtom) !== "live") return;
  const current: GraphSnapshot = {
    nodes: get(editorNodesAtom),
    edges: get(editorEdgesAtom),
  };
  const past = get(historyPastAtom);
  set(historyPastAtom, [...past.slice(-(HISTORY_LIMIT - 1)), current]);
  set(historyFutureAtom, []);
});

export const undoAtom = atom(null, (get, set) => {
  const past = get(historyPastAtom);
  if (past.length === 0) return;
  const previous = past[past.length - 1];
  const current: GraphSnapshot = {
    nodes: get(editorNodesAtom),
    edges: get(editorEdgesAtom),
  };
  set(historyPastAtom, past.slice(0, -1));
  set(historyFutureAtom, [current, ...get(historyFutureAtom)].slice(0, HISTORY_LIMIT));
  set(editorNodesAtom, previous.nodes);
  set(editorEdgesAtom, previous.edges);
  if (get(graphModeAtom) === "live") {
    set(isCanvasDirtyAtom, true);
  }
});

export const redoAtom = atom(null, (get, set) => {
  const future = get(historyFutureAtom);
  if (future.length === 0) return;
  const nextSnapshot = future[0];
  const current: GraphSnapshot = {
    nodes: get(editorNodesAtom),
    edges: get(editorEdgesAtom),
  };
  set(historyFutureAtom, future.slice(1));
  set(historyPastAtom, [...get(historyPastAtom).slice(-(HISTORY_LIMIT - 1)), current]);
  set(editorNodesAtom, nextSnapshot.nodes);
  set(editorEdgesAtom, nextSnapshot.edges);
  if (get(graphModeAtom) === "live") {
    set(isCanvasDirtyAtom, true);
  }
});

// Replaces the graph without touching history or dirty state. Used for server
// hydration and AI draft previews.
export const replaceGraphAtom = atom(null, (get, set, snapshot: GraphSnapshot) => {
  set(editorNodesAtom, snapshot.nodes ?? []);
  set(editorEdgesAtom, snapshot.edges ?? []);
});

// Clears transient editor state when leaving the editor page.
export const resetEditorStoreAtom = atom(null, (_get, set) => {
  set(editorNodesAtom, []);
  set(editorEdgesAtom, []);
  set(historyPastAtom, []);
  set(historyFutureAtom, []);
  set(graphModeAtom, "live");
  set(draftPreviewAtom, null);
  set(isCanvasDirtyAtom, false);
  set(nodeSelectorOpenAtom, false);
  set(pendingEdgeInsertAtom, null);
});
