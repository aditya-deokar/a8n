"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon, TerminalIcon, SparklesIcon, ExternalLinkIcon } from "lucide-react";
import Image from "next/image";

export const McpClientConfigs = () => {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const endpointUrl = origin.includes("localhost")
    ? `${origin.replace("localhost", "127.0.0.1")}/api/mcp`
    : `${origin}/api/mcp`;

  const presets: Record<string, { title: string; logo?: string; code: string; desc: string; filename?: string }> = {
    antigravity: {
      title: "Antigravity",
      logo: "/logos/gemini.svg",
      desc: "Connect Google Gemini and the Antigravity agentic framework to a8n operations.",
      filename: ".gemini/settings.json",
      code: JSON.stringify(
        {
          mcpServers: {
            a8n: {
              command: "npx",
              args: ["-y", "mcp-remote", endpointUrl],
              env: {
                MCP_HEADERS: "Authorization: Bearer a8n_mcp_<your_api_key>",
              },
            },
          },
        },
        null,
        2
      ),
    },
    cursor: {
      title: "Cursor IDE",
      desc: "Integrate a8n directly into Cursor's Composer and Agent Chat.",
      filename: ".cursor/mcp.json",
      code: JSON.stringify(
        {
          mcpServers: {
            a8n: {
              url: endpointUrl,
              transport: "streamable-http",
              headers: {
                Authorization: "Bearer a8n_mcp_<your_api_key>",
              },
            },
          },
        },
        null,
        2
      ),
    },
    claude: {
      title: "Claude Code",
      logo: "/logos/anthropic.svg",
      desc: "Provide Anthropic Claude Desktop and Claude Code CLI with complete a8n capabilities.",
      filename: "claude_desktop_config.json",
      code: JSON.stringify(
        {
          mcpServers: {
            a8n: {
              command: "npx",
              args: ["-y", "mcp-remote", endpointUrl],
              env: {
                MCP_HEADERS: "Authorization: Bearer a8n_mcp_<your_api_key>",
              },
            },
          },
        },
        null,
        2
      ),
    },
    inspector: {
      title: "MCP Inspector",
      desc: "Official debugging client to view and execute tools, resources, and prompts.",
      code: `# 1. Start the inspector CLI\nnpx @modelcontextprotocol/inspector\n\n# 2. Open the UI and connect with:\n# Transport: Streamable HTTP\n# URL:       ${endpointUrl}\n# Header:    Authorization: Bearer a8n_mcp_<your_api_key>`,
    },
  };

  const handleCopy = (tabKey: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TerminalIcon className="size-4 text-primary" />
          <span>Client Integration Presets</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Select your preferred AI assistant to view drop-in configuration snippets. Be sure to replace the placeholder with your generated secret key.
        </p>
      </div>

      <Tabs defaultValue="antigravity" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-1 bg-accent/40 p-1">
          {Object.entries(presets).map(([key, preset]) => (
            <TabsTrigger key={key} value={key} className="text-xs py-2 gap-1.5 font-medium">
              {preset.logo && (
                <Image src={preset.logo} alt={preset.title} width={14} height={14} className="shrink-0" />
              )}
              <span>{preset.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(presets).map(([key, preset]) => (
          <TabsContent key={key} value={key} className="mt-3">
            <div className="rounded-lg border bg-background overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 bg-accent/30 border-b gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{preset.title}</span>
                  {preset.filename && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono bg-background px-1.5 py-0.5 rounded border text-[11px]">
                        {preset.filename}
                      </span>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs hover:bg-background"
                  onClick={() => handleCopy(key, preset.code)}
                >
                  {copiedTab === key ? (
                    <>
                      <CheckIcon className="size-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 bg-muted/20 font-mono text-xs overflow-x-auto text-foreground/90 leading-relaxed selection:bg-primary selection:text-primary-foreground">
                <pre>{preset.code}</pre>
              </div>

              <div className="px-3 py-2 bg-accent/10 border-t text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                <span>{preset.desc}</span>
                {key === "inspector" && (
                  <a
                    href="https://github.com/modelcontextprotocol/inspector"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 font-medium shrink-0"
                  >
                    <span>Docs</span>
                    <ExternalLinkIcon className="size-2.5" />
                  </a>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
