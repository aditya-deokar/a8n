"use client";

import React from "react";
import { McpKeysList } from "./mcp-keys-list";
import { McpOAuthConnections } from "./mcp-oauth-connections";
import { McpClientConfigs } from "./mcp-client-configs";
import { McpKeyCreatePanel } from "./mcp-key-create-modal";
import { McpSecurityCenter } from "./mcp-security-center";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";

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
  const setIsOpen = React.useCallback(
    (open: boolean) => setIsOpenQuery(open ? "true" : null),
    [setIsOpenQuery],
  );
  const panelRef = React.useRef<HTMLDivElement>(null);

  // A slide-over that can only be dismissed with the mouse traps keyboard
  // users, so Escape closes it and focus moves into it when it opens.
  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setIsOpen]);

  return (
    <EntityContainer
      header={<McpDashboardHeader onToggle={() => setIsOpen(!isOpen)} isOpen={isOpen} />}
    >
      <div className="flex flex-col gap-8 relative z-0 mt-4">
        <section className="flex flex-col gap-3" aria-labelledby="mcp-security-heading">
          <h2
            id="mcp-security-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1"
          >
            Security overview
          </h2>
          <McpSecurityCenter />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="mcp-keys-heading">
          <h2
            id="mcp-keys-heading"
            className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1"
          >
            Active API keys
          </h2>
          <McpKeysList onNew={() => setIsOpen(true)} />
        </section>

        <section className="border-t pt-6 border-gray-200 dark:border-zinc-800">
          <McpOAuthConnections />
        </section>

        <section className="border-t pt-6 border-gray-200 dark:border-zinc-800">
          <McpClientConfigs />
        </section>

        {/* Floating panel for API key creation */}
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="Create MCP API key"
          aria-hidden={!isOpen}
          className={cn(
            "fixed top-24 right-4 sm:right-8 h-[calc(100vh-8rem)] w-[400px] max-w-[calc(100vw-2rem)] z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right",
            isOpen
              ? "translate-x-0 scale-100 opacity-100 pointer-events-auto"
              : "translate-x-[110%] scale-95 opacity-0 pointer-events-none",
          )}
        >
          <div
            ref={panelRef}
            className={cn(
              "w-full h-full shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col transition-all duration-500 rounded-2xl border",
              isOpen
                ? "bg-white/70 dark:bg-zinc-900/80 backdrop-blur-2xl border-white/50 dark:border-zinc-700/50 relative z-0"
                : "bg-white/40 dark:bg-zinc-950/40 backdrop-blur-xl border-white/20 dark:border-zinc-800/30 relative z-0",
            )}
          >
            <McpKeyCreatePanel onClose={() => setIsOpen(false)} />
          </div>
        </aside>
      </div>
    </EntityContainer>
  );
};
