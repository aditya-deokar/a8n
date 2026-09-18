"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlugZapIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorView, LoadingView } from "@/components/entity-components";
import { useMcpSecuritySummary } from "../hooks/use-mcp-keys";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
      }
    >
      {ok ? (
        <CheckCircle2Icon className="size-3" aria-hidden="true" />
      ) : (
        <AlertTriangleIcon className="size-3" aria-hidden="true" />
      )}
      {label}
      <span className="sr-only">{ok ? " — configured" : " — needs attention"}</span>
    </span>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-lg border border-gray-100 bg-white/50 p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111111]/80">
      <CardContent className="flex items-start justify-between gap-3 p-0">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{caption}</span>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

/**
 * Posture summary for the MCP server.
 *
 * Deliberately does not repeat the OAuth connection list: `McpOAuthConnections`
 * owns that, and rendering both on the same page showed every connected client
 * twice.
 */
export function McpSecurityCenter() {
  const summary = useMcpSecuritySummary();

  if (summary.isLoading) {
    return <LoadingView message="Loading MCP security summary..." />;
  }

  if (summary.isError || !summary.data) {
    return <ErrorView message="Failed to load MCP security summary" />;
  }

  const data = summary.data;
  const schemaReady = data.audit.schemaReady !== false;
  const postureOk =
    schemaReady &&
    data.recommendations.length === 0 &&
    data.audit.databaseEnabled &&
    !data.guardrails.corsWildcard;
  const iconClass = "size-5 text-[#5c54a4] dark:text-indigo-400";

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SummaryCard
          label="Security posture"
          value={postureOk ? "Ready" : "Needs review"}
          caption={`${data.recommendations.length} open recommendation${data.recommendations.length === 1 ? "" : "s"}`}
          icon={<ShieldCheckIcon className={iconClass} aria-hidden="true" />}
        />
        <SummaryCard
          label="Connected apps"
          value={data.oauth.connectedClients}
          caption={`${data.oauth.activeTokens} active OAuth token${data.oauth.activeTokens === 1 ? "" : "s"}`}
          icon={<PlugZapIcon className={iconClass} aria-hidden="true" />}
        />
        <SummaryCard
          label="Audit events"
          value={data.audit.eventsLast24h}
          caption={`${data.audit.failedEventsLast24h} failed in the last 24h`}
          icon={<ActivityIcon className={iconClass} aria-hidden="true" />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill ok={schemaReady} label="MCP schema" />
        <StatusPill ok={data.audit.databaseEnabled} label="Audit DB" />
        <StatusPill
          ok={data.guardrails.rateLimitBackend === "database"}
          label="Distributed rate limit"
        />
        <StatusPill ok={!data.guardrails.corsWildcard} label="Explicit CORS" />
        <StatusPill ok={data.guardrails.safeFetchAllowlistMode} label="Egress allowlist" />
      </div>

      {/* The recommendations were fetched but never shown; they are the only
          actionable part of the summary. */}
      {data.recommendations.length > 0 ? (
        <Card className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardContent className="grid gap-2 p-0">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon
                className="size-4 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Recommended before production
              </h3>
            </div>
            <ul className="grid gap-1.5 pl-6 text-xs text-amber-900/90 dark:text-amber-200/90">
              {data.recommendations.map((recommendation) => (
                <li key={recommendation} className="list-disc">
                  {recommendation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">
          No outstanding security recommendations.
        </p>
      )}

      {data.audit.latestEvent ? (
        <p className="text-xs text-muted-foreground">
          Last MCP activity: <span className="font-medium">{data.audit.latestEvent.tool}</span>{" "}
          ({data.audit.latestEvent.status}){" "}
          {formatDistanceToNow(new Date(data.audit.latestEvent.timestamp), {
            addSuffix: true,
          })}
          .
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No MCP activity recorded yet.</p>
      )}
    </div>
  );
}
