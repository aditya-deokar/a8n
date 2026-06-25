"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_SCOPES, MCP_SCOPES } from "@/mcp/auth/scopes";
import { useCreateMcpKey } from "../hooks/use-mcp-keys";
import { CheckIcon, CopyIcon, KeyIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";

export const McpKeyCreatePanel = ({ onClose }: { onClose: () => void }) => {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_SCOPES]);
  const [expiresInDays, setExpiresInDays] = useState<number>(0); // 0 means never
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateMcpKey();

  const handleScopeToggle = (scope: string) => {
    if (scope === "*") {
      setScopes(["*"]);
      return;
    }

    let nextScopes = scopes.filter((s) => s !== "*");
    if (nextScopes.includes(scope)) {
      nextScopes = nextScopes.filter((s) => s !== scope);
    } else {
      nextScopes.push(scope);
    }

    if (nextScopes.length === 0) nextScopes = [...DEFAULT_SCOPES];
    setScopes(nextScopes);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate(
      {
        name: name.trim(),
        scopes: scopes.length > 0 ? scopes : ["*"],
        expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
      },
      {
        onSuccess: (data) => {
          setCreatedKey(data.rawKey);
        },
      }
    );
  };

  const handleCopy = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setName("");
      setScopes([...DEFAULT_SCOPES]);
      setExpiresInDays(0);
      setCreatedKey(null);
      setCopied(false);
      createMutation.reset();
    }, 300);
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-white dark:bg-[#0f0f11]">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 right-4 z-10 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
        onClick={handleClose}
      >
        <XIcon className="size-4" />
      </Button>

      <div className="pb-4 pt-6 px-6 border-b border-gray-100 dark:border-zinc-800/50 flex-shrink-0">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <KeyIcon className="size-5 text-primary" />
          <span>{createdKey ? "API Key Generated" : "Create MCP API Key"}</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 pr-6">
          {createdKey
            ? "Copy your API key now. For your security, it will never be shown again."
            : "Generate a new secure, scoped API key to authenticate MCP clients."}
        </p>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {createdKey ? (
          <div className="flex flex-col gap-4 py-3 animate-in fade-in-50 duration-300">
            <div className="rounded-lg bg-accent/30 border p-3.5 flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Raw Secret Key
              </span>
              <div className="flex items-center justify-between gap-2 bg-background border rounded-md p-2 font-mono text-sm break-all select-all">
                <span className="text-primary font-semibold">{createdKey}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="shrink-0"
                  title="Copy key"
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-emerald-500 animate-in scale-in-50 duration-200" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-md">
              <SparklesIcon className="size-4 shrink-0" />
              <span>Configure your client using this Bearer token immediately.</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Claude Code Local, Cursor Workspace"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Expiration</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Never", value: 0 },
                  { label: "7 days", value: 7 },
                  { label: "30 days", value: 30 },
                  { label: "90 days", value: 90 },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={expiresInDays === preset.value ? "default" : "outline"}
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setExpiresInDays(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="flex items-center justify-between">
                <span>Permissions Scopes</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {scopes.includes("*") ? "Full Access" : `${scopes.length} selected`}
                </span>
              </Label>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 border rounded-md p-2 bg-accent/10">
                {Object.entries(MCP_SCOPES).map(([scopeKey, description]) => {
                  const checked = scopes.includes("*") ? true : scopes.includes(scopeKey);
                  const isWildcard = scopeKey === "*";
                  return (
                    <div
                      key={scopeKey}
                      className={`flex items-start gap-2.5 p-1.5 rounded hover:bg-accent/40 transition-colors cursor-pointer ${
                        isWildcard ? "border-b pb-2 mb-1" : ""
                      }`}
                      onClick={() => handleScopeToggle(scopeKey)}
                    >
                      <Checkbox
                         checked={checked}
                         disabled={scopes.includes("*") && !isWildcard}
                         className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="text-xs font-semibold font-mono text-foreground">
                          {scopeKey}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-col gap-3 pt-6 mt-auto">
              <Button
                type="button"
                className="w-full rounded-xl h-12 bg-[#5c54a4] hover:bg-[#4a4387] text-white font-semibold text-[15px] shadow-md shadow-[#5c54a4]/20 transition-all active:scale-[0.98]"
                onClick={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Generating..." : "Generate Key"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-xl h-12 hover:bg-gray-100 dark:hover:bg-zinc-900/50 text-gray-700 dark:text-gray-300 font-semibold text-[15px] transition-all active:scale-[0.98]"
                onClick={handleClose}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {createdKey && (
          <div className="flex flex-col gap-3 pt-6 mt-auto">
            <Button
              type="button"
              className="w-full rounded-xl h-12 bg-[#5c54a4] hover:bg-[#4a4387] text-white font-semibold text-[15px] shadow-md shadow-[#5c54a4]/20 transition-all active:scale-[0.98]"
              onClick={handleClose}
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
