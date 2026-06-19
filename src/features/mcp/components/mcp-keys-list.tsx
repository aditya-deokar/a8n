"use client";

import React from "react";
import { useMcpKeys, useRevokeMcpKey } from "../hooks/use-mcp-keys";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyIcon, TrashIcon, ShieldAlertIcon, CheckCircle2Icon } from "lucide-react";
import { LoadingView, ErrorView } from "@/components/entity-components";
import { PlusIcon } from "lucide-react";

export const McpKeysList = ({ onNew }: { onNew: () => void }) => {
  const { data: keys, isLoading, isError } = useMcpKeys();
  const revokeMutation = useRevokeMcpKey();

  if (isLoading) {
    return <LoadingView message="Loading API keys..." />;
  }

  if (isError || !keys) {
    return <ErrorView message="Failed to load MCP API keys" />;
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-sm rounded-[1.5rem] text-center gap-4">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <KeyIcon className="size-6" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h3 className="font-semibold text-base">No API Keys Found</h3>
          <p className="text-xs text-muted-foreground">
            Generate an API key to securely connect external clients like Cursor, Claude Code, or Antigravity to your workspace.
          </p>
        </div>
        <Button onClick={onNew} size="sm" className="bg-[#5c54a4] hover:bg-[#4a4387] text-white shadow-sm shadow-[#5c54a4]/20 gap-1.5 transition-all">
          <PlusIcon className="size-4" />
          <span>Generate API Key</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((apiKey) => {
        const isExpired = apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false;
        const isWildcard = apiKey.scopes.includes("*");

        return (
          <Card key={apiKey.id} className="p-4 bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-sm hover:bg-gray-50 dark:hover:bg-[#1c1c1e]/80 rounded-[1.5rem] transition-all duration-300">
            <CardContent className="p-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <KeyIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{apiKey.name}</span>
                    <span className="font-mono text-xs bg-gray-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-gray-500 dark:text-zinc-400">
                      {apiKey.keyPrefix}...
                    </span>
                    {isWildcard ? (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                        Full Access
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {apiKey.scopes.length} Scopes
                      </span>
                    )}
                    {isExpired && (
                      <span className="text-[10px] font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldAlertIcon className="size-2.5" />
                        Expired
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
                    <span>
                      Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {apiKey.lastUsedAt ? (
                        <>Last used {formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })}</>
                      ) : (
                        "Never used"
                      )}
                    </span>
                    {apiKey.expiresAt && (
                      <>
                        <span>&bull;</span>
                        <span>
                          Expires {formatDistanceToNow(new Date(apiKey.expiresAt), { addSuffix: true })}
                        </span>
                      </>
                    )}
                  </div>

                  {!isWildcard && apiKey.scopes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {apiKey.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-[10px] font-mono bg-accent/40 text-muted-foreground px-1.5 py-0.2 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-8 px-2.5"
                  disabled={revokeMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to revoke "${apiKey.name}"? Clients using this key will immediately lose access.`)) {
                      revokeMutation.mutate({ id: apiKey.id });
                    }
                  }}
                >
                  <TrashIcon className="size-3.5" />
                  <span>Revoke</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
