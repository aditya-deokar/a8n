"use client";

import React from "react";
import { McpKeysList } from "./mcp-keys-list";
import { McpClientConfigs } from "./mcp-client-configs";
import { McpKeyCreatePanel } from "./mcp-key-create-modal";
import { ServerIcon, ShieldCheckIcon, CpuIcon, LayersIcon, PlusIcon, XIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";

export const McpDashboardHeader = ({ onToggle, isOpen }: { onToggle?: () => void, isOpen?: boolean }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-xl bg-gradient-to-br from-[#e8e9f5] to-[#f4f3fb] dark:from-indigo-950/50 dark:to-indigo-900/50 flex items-center justify-center text-[#5c54a4] dark:text-indigo-400 shrink-0 border border-white dark:border-indigo-900/50 shadow-inner">
          <ServerIcon className="size-7" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Model Context Protocol</h1>
            <span className="text-xs font-bold tracking-wide uppercase bg-[#5c54a4]/10 text-[#5c54a4] dark:text-indigo-300 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-[#5c54a4]/20 dark:border-indigo-500/20 shadow-sm">
              v1.0 Server
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
        <Button 
          size="sm" 
          onClick={onToggle} 
          className={cn(
            "shadow-sm gap-1.5 transition-all",
            isOpen 
              ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-none"
              : "bg-[#5c54a4] hover:bg-[#4a4387] text-white shadow-[#5c54a4]/20"
          )}
        >
          {isOpen ? (
            <>
              <XIcon className="size-4" />
              <span>Close Panel</span>
            </>
          ) : (
            <>
              <PlusIcon className="size-4" />
              <span>Generate API Key</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export const McpDashboardOverview = () => {
  const metrics = [
    {
      title: "Active Capabilities",
      value: "78 Total",
      desc: "53 Tools, 17 Resources, 5 Templates, 3 Prompts",
      icon: LayersIcon,
    },
    {
      title: "Protocol Security",
      value: "Bearer Hashed",
      desc: "SHA-256 persistent database tokens",
      icon: ShieldCheckIcon,
    },
    {
      title: "Transport Layer",
      value: "Streamable HTTP",
      desc: "Stateless SSE protocol messaging",
      icon: CpuIcon,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {metrics.map((metric, idx) => (
        <Card key={idx} className="p-5 bg-white dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-sm hover:shadow-md dark:shadow-none hover:bg-gray-50 dark:hover:bg-[#1c1c1e]/80 rounded-[1.5rem] transition-all duration-300">
          <CardContent className="p-0 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">{metric.title}</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{metric.value}</span>
            </div>
            <div className="size-10 rounded-xl bg-[#f8f9fc] dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
              <metric.icon className="size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const McpDashboardView = () => {
  const [isOpenQuery, setIsOpenQuery] = useQueryState("new");
  const isOpen = isOpenQuery === "true";
  const setIsOpen = (open: boolean) => setIsOpenQuery(open ? "true" : null);

  return (
    <div className="flex flex-row h-full w-full overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0 transition-all duration-300">
        <div className="bg-[#f6f8fb] dark:bg-zinc-950 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm p-6 shrink-0 flex w-full">
          <McpDashboardHeader onToggle={() => setIsOpen(!isOpen)} isOpen={isOpen} />
        </div>

        <main className="relative flex-1 h-full flex flex-col bg-[#f6f8fb] dark:bg-zinc-950 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden min-w-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="flex flex-col gap-8">
              <McpDashboardOverview />

              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">Active API Keys</h2>
                <McpKeysList onNew={() => setIsOpen(true)} />
              </div>

              <div className="border-t pt-6">
                <McpClientConfigs />
              </div>
            </div>
          </div>
        </main>
      </div>

      <aside 
        className={cn(
          "shrink-0 h-full overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out flex flex-col min-h-0",
          isOpen ? "w-[400px] ml-2 opacity-100" : "w-0 ml-0 opacity-0"
        )}
      >
        <div className="w-[400px] h-full bg-[#f6f8fb] dark:bg-zinc-950 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden flex flex-col">
          <McpKeyCreatePanel onClose={() => setIsOpen(false)} />
        </div>
      </aside>
    </div>
  );
};
