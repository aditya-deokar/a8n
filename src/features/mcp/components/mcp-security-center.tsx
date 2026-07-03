"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlugZapIcon,
  ShieldCheckIcon,
  UnplugIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorView, LoadingView } from "@/components/entity-components";
import {
  useMcpOAuthConnections,
  useMcpSecuritySummary,
  useRevokeMcpOAuthConnection,
} from "../hooks/use-mcp-keys";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
      }
    >
      {ok ? <CheckCircle2Icon className="size-3" /> : <AlertTriangleIcon className="size-3" />}
      {label}
    </span>
  );
}

export function McpSecurityCenter() {
  const summary = useMcpSecuritySummary();
  const connections = useMcpOAuthConnections();
  const revokeConnection = useRevokeMcpOAuthConnection();

  if (summary.isLoading || connections.isLoading) {
    return <LoadingView message="Loading MCP security summary..." />;
  }

  if (summary.isError || connections.isError || !summary.data || !connections.data) {
    return <ErrorView message="Failed to load MCP security summary" />;
  }

  const data = summary.data;
  const schemaReady = data.audit.schemaReady !== false;
  const postureOk =
    schemaReady &&
    data.recommendations.length === 0 &&
    data.audit.databaseEnabled &&
    !data.guardrails.corsWildcard;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="rounded-lg border border-gray-100 bg-white/50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111111]/80">
          <CardContent className="flex items-start justify-between gap-3 p-0">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Security Posture</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {postureOk ? "Ready" : "Needs Review"}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.recommendations.length} open recommendation{data.recommendations.length === 1 ? "" : "s"}
              </span>
            </div>
            <ShieldCheckIcon className="size-5 text-[#5c54a4]" />
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-gray-100 bg-white/50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111111]/80">
          <CardContent className="flex items-start justify-between gap-3 p-0">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Connected Apps</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {data.oauth.connectedClients}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.oauth.activeTokens} active OAuth token{data.oauth.activeTokens === 1 ? "" : "s"}
              </span>
            </div>
            <PlugZapIcon className="size-5 text-[#5c54a4]" />
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-gray-100 bg-white/50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111111]/80">
          <CardContent className="flex items-start justify-between gap-3 p-0">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Audit Events</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {data.audit.eventsLast24h}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.audit.failedEventsLast24h} failed in 24h
              </span>
            </div>
            <ActivityIcon className="size-5 text-[#5c54a4]" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill ok={schemaReady} label="MCP schema" />
        <StatusPill ok={data.audit.databaseEnabled} label="Audit DB" />
        <StatusPill ok={data.guardrails.rateLimitBackend === "database"} label="Distributed rate limit" />
        <StatusPill ok={!data.guardrails.corsWildcard} label="Explicit CORS" />
        <StatusPill ok={data.guardrails.safeFetchAllowlistMode} label="Egress allowlist" />
      </div>

      {connections.data.length > 0 && (
        <div className="grid gap-2">
          {connections.data.map((connection) => (
            <Card key={connection.consentId} className="rounded-lg border border-gray-100 bg-white/50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111111]/80">
              <CardContent className="flex flex-col gap-3 p-0 md:flex-row md:items-center md:justify-between">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {connection.clientName}
                    </span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {connection.scopes.length} scopes
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Connected {formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true })}
                    </span>
                    <span>
                      {connection.lastUsedAt
                        ? `Last used ${formatDistanceToNow(new Date(connection.lastUsedAt), { addSuffix: true })}`
                        : "Never used"}
                    </span>
                    <span>
                      {connection.activeAccessTokens + connection.activeRefreshTokens} active tokens
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revokeConnection.isPending}
                  className="h-8 justify-start gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive md:justify-center"
                  onClick={() => {
                    if (window.confirm(`Revoke OAuth access for "${connection.clientName}"?`)) {
                      revokeConnection.mutate({ clientId: connection.clientId });
                    }
                  }}
                >
                  <UnplugIcon className="size-3.5" />
                  <span>Revoke</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
