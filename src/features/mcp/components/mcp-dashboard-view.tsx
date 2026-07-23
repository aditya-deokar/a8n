"use client";

import React from "react";
import { McpKeysList } from "./mcp-keys-list";
import { McpOAuthConnections } from "./mcp-oauth-connections";
import { McpClientConfigs } from "./mcp-client-configs";
import { McpKeyCreatePanel } from "./mcp-key-create-modal";
import { ServerIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { EntityContainer, EntityHeader } from "@/components/entity-components";

export const McpDashboardHeader = ({ onToggle, isOpen }: { onToggle?: () => void, isOpen?: boolean }) => {
  return (
    <EntityHeader
      title="Model Context Protocol"
      description="Manage your MCP server API Keys and client configurations"
      onNew={onToggle!}
      newButtonLabel="Generate API Key"
      isOpen={isOpen}
    />
  );
};

export const McpDashboardView = () => {
  const [isOpenQuery, setIsOpenQuery] = useQueryState("new");
  const isOpen = isOpenQuery === "true";
  const setIsOpen = (open: boolean) => setIsOpenQuery(open ? "true" : null);

  return (
    <EntityContainer
      header={<McpDashboardHeader onToggle={() => setIsOpen(!isOpen)} isOpen={isOpen} />}
    >
      <div className="flex flex-col gap-8 relative z-0 mt-4">

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">Active API Keys</h2>
          <McpKeysList onNew={() => setIsOpen(true)} />
        </div>

        <div className="border-t pt-6 border-gray-200 dark:border-zinc-800">
          <McpOAuthConnections />
        </div>

        <div className="border-t pt-6 border-gray-200 dark:border-zinc-800">
          <McpClientConfigs />
        </div>

        {/* Floating Panel for API Key Creation */}
        <aside 
          className={cn(
            "fixed top-24 right-8 h-[calc(100vh-8rem)] w-[400px] z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right",
            isOpen 
              ? "translate-x-0 scale-100 opacity-100 pointer-events-auto" 
              : "translate-x-[110%] scale-95 opacity-0 pointer-events-none"
          )}
        >
          <div className={cn(
            "w-full h-full shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col transition-all duration-500 rounded-2xl border",
            isOpen 
              ? "bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl border-white/50 dark:border-zinc-700/50 relative z-0" 
              : "bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl border-white/20 dark:border-zinc-800/30 relative z-0"
          )}>
            <McpKeyCreatePanel onClose={() => setIsOpen(false)} />
          </div>
        </aside>
      </div>
    </EntityContainer>
  );
};
