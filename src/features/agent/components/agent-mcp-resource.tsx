"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ServerIcon,
  CodeIcon,
  BracesIcon,
  ClockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

export interface MCPToolResult {
  toolName: string;
  result: unknown;
  /** How long the tool took to execute (ms). */
  duration?: number;
}

export interface AgentMCPResourceProps {
  /** The MCP tool result data to render. */
  data: MCPToolResult;
}

// ─── Helpers ─────────────────────────────────────────────────

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function formatValue(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val === null || val === undefined) return "—";
  return JSON.stringify(val, null, 2);
}

// ─── JSON Renderer ───────────────────────────────────────────

function JsonDisplay({ data }: { data: unknown }) {
  if (!isObject(data)) {
    return (
      <pre className="text-[11px] font-mono text-foreground/80 bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
        {formatValue(data)}
      </pre>
    );
  }

  const entries = Object.entries(data);

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-[11px]">
          <span className="font-mono text-muted-foreground shrink-0 min-w-[80px] text-right">
            {key}:
          </span>
          {isObject(value) || Array.isArray(value) ? (
            <pre className="font-mono text-foreground/80 bg-muted/30 rounded px-1.5 py-0.5 overflow-x-auto whitespace-pre-wrap flex-1 min-w-0">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <span className="text-foreground/80 break-all">
              {formatValue(value)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export function AgentMCPResource({ data }: AgentMCPResourceProps) {
  return (
    <div className="mt-2 max-w-md">
      <Card className="shadow-sm border-border/60 bg-card/80 overflow-hidden">
        <CardHeader className="p-2.5 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
              <ServerIcon className="size-3" />
              <span className="font-mono">{data.toolName}</span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {data.duration && (
                <Badge
                  variant="outline"
                  className="h-4 px-1 text-[8px] font-mono text-muted-foreground"
                >
                  <ClockIcon className="size-2 mr-0.5" />
                  {data.duration < 1000
                    ? `${data.duration}ms`
                    : `${(data.duration / 1000).toFixed(1)}s`}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="h-4 px-1 text-[8px] font-mono text-muted-foreground"
              >
                <BracesIcon className="size-2 mr-0.5" />
                MCP
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2.5 pt-1">
          <JsonDisplay data={data.result} />
        </CardContent>
      </Card>
    </div>
  );
}
