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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ServerIcon className="size-5.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-semibold">Model Context Protocol</h1>
            <span className="text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
              v1.0 Server
            </span>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {metrics.map((metric, idx) => (
        <Card key={idx} className="p-4 shadow-none bg-accent/10 border-accent/40">
          <CardContent className="p-0 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">{metric.title}</span>
              <span className="text-base font-semibold text-foreground">{metric.value}</span>
              <span className="text-[11px] text-muted-foreground">{metric.desc}</span>
            </div>
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
              <metric.icon className="size-4" />
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
