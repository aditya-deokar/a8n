"use client";

import React from "react";
import { EntityContainer } from "@/components/entity-components";
import { McpKeysList } from "./mcp-keys-list";
import { McpClientConfigs } from "./mcp-client-configs";
import { McpKeyCreateModal } from "./mcp-key-create-modal";
import { ServerIcon, ShieldCheckIcon, CpuIcon, LayersIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const McpDashboardHeader = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-xl bg-gradient-to-br from-[#e8e9f5] to-[#f4f3fb] flex items-center justify-center text-[#5c54a4] shrink-0 border border-white shadow-inner">
          <ServerIcon className="size-7" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Model Context Protocol</h1>
            <span className="text-xs font-bold tracking-wide uppercase bg-[#5c54a4]/10 text-[#5c54a4] px-2.5 py-1 rounded-lg border border-[#5c54a4]/20 shadow-sm">
              v1.0 Server
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            Manage your secure MCP API keys and external agentic application integrations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
        <McpKeyCreateModal />
      </div>
    </div>
  );
};

export const McpDashboardOverview = () => {
  const metrics = [
    {
      title: "Active Capabilities",
      value: "29 Total",
      desc: "22 Tools, 4 Resources, 3 Prompts",
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
        <Card key={idx} className="p-5 bg-white border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-2xl transition-all duration-300">
          <CardContent className="p-0 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-500 font-medium">{metric.title}</span>
              <span className="text-xl font-bold text-gray-900 tracking-tight">{metric.value}</span>
              <span className="text-xs text-gray-400 font-medium">{metric.desc}</span>
            </div>
            <div className="size-10 rounded-xl bg-[#f8f9fc] border border-gray-100 flex items-center justify-center text-gray-500 shrink-0">
              <metric.icon className="size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const McpDashboardView = () => {
  return (
    <EntityContainer header={<McpDashboardHeader />}>
      <div className="flex flex-col gap-8">
        <McpDashboardOverview />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">Active API Keys</h2>
            <p className="text-xs text-muted-foreground">
              These keys grant authenticated external agents scoped execution access to your node workflows.
            </p>
          </div>
          <McpKeysList />
        </div>

        <div className="border-t pt-6">
          <McpClientConfigs />
        </div>
      </div>
    </EntityContainer>
  );
};
