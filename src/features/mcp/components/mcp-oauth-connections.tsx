"use client";

import React, { useState } from "react";
import { useMcpOAuthConnections, useRevokeMcpOAuthConnection } from "../hooks/use-mcp-keys";
import { Button } from "@/components/ui/button";
import { LinkIcon, ShieldCheckIcon, XIcon, KeyIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const McpOAuthConnections = () => {
  const { data: connections, isLoading } = useMcpOAuthConnections();
  const revokeMutation = useRevokeMcpOAuthConnection();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">
          OAuth Connections
        </h2>
        <div className="rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
            <LinkIcon className="size-4" />
            <span>Loading OAuth connections…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">
          OAuth Connections
        </h2>
        <div className="rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <LinkIcon className="size-4" />
            <span>No OAuth clients connected. Clients like Antigravity and Claude Code will appear here after linking.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">
        OAuth Connections
      </h2>

      <div className="flex flex-col gap-2">
        {connections.map((connection) => (
          <div
            key={connection.consentId}
            className="rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl overflow-hidden transition-all duration-200 hover:border-gray-200 dark:hover:border-white/[0.12]"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              {/* Left: Connection info */}
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center justify-center size-10 rounded-xl bg-[#5c54a4]/10 dark:bg-indigo-500/10 shrink-0">
                  <ShieldCheckIcon className="size-5 text-[#5c54a4] dark:text-indigo-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {connection.clientName}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>
                      Connected{" "}
                      {formatDistanceToNow(new Date(connection.connectedAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <KeyIcon className="size-3" />
                      {connection.activeAccessTokens} active
                      {connection.activeAccessTokens !== 1 ? " tokens" : " token"}
                    </span>
                    {connection.lastUsedAt && (
                      <>
                        <span>•</span>
                        <span>
                          Last used{" "}
                          {formatDistanceToNow(new Date(connection.lastUsedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Revoke */}
              <div className="shrink-0">
                {confirmingId === connection.clientId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 font-medium">Revoke?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-3 text-xs rounded-lg"
                      disabled={revokeMutation.isPending}
                      onClick={() => {
                        revokeMutation.mutate(
                          { clientId: connection.clientId },
                          { onSettled: () => setConfirmingId(null) }
                        );
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs rounded-lg"
                      onClick={() => setConfirmingId(null)}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 px-3 rounded-lg text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setConfirmingId(connection.clientId)}
                  >
                    <XIcon className="size-3" />
                    Revoke
                  </Button>
                )}
              </div>
            </div>

            {/* Scopes row */}
            <div className="px-5 pb-3">
              <div className="flex flex-wrap gap-1">
                {connection.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[#f8f9fc] dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-white/[0.08]"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
