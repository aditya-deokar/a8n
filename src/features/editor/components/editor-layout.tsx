"use client";

import { useAtomValue } from "jotai";
import { isAgentSidebarOpenAtom } from "../store/atoms";
import { AgentSidebar } from "./agent-sidebar";
import { cn } from "@/lib/utils";

export function EditorLayout({ 
  workflowId, 
  children 
}: { 
  workflowId: string;
  children: React.ReactNode;
}) {
  const isAgentOpen = useAtomValue(isAgentSidebarOpenAtom);

  return (
    <div className="relative flex-1 h-full w-full min-h-0">
      {/* The main canvas */}
      <div className="absolute inset-0 z-0">
        {children}
      </div>

      {/* Floating Agent Sidebar (Desktop) */}
      {isAgentOpen && (
        <div 
          className={cn(
            "hidden md:flex absolute top-4 right-4 bottom-4 w-96 z-50 flex-col",
            "shadow-2xl rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800",
            "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl"
          )}
        >
          <AgentSidebar workflowId={workflowId} />
        </div>
      )}

      {/* Mobile view (Full screen overlay) */}
      {isAgentOpen && (
        <div className="absolute inset-0 z-[100] md:hidden bg-background">
          <AgentSidebar workflowId={workflowId} />
        </div>
      )}
    </div>
  );
}
