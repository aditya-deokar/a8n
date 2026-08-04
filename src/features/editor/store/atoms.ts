import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";

export const editorAtom = atom<ReactFlowInstance | null>(null);
export const nodeSelectorOpenAtom = atom<boolean>(false);

// Agent / Editor state
export const isAgentSidebarOpenAtom = atom<boolean>(false);
export const graphModeAtom = atom<"live" | "draft" | "applied">("live");
export const isCanvasDirtyAtom = atom<boolean>(false);
export const draftPreviewAtom = atom<{ nodes?: any[], edges?: any[] } | null>(null);
