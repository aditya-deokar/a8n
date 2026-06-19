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
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">Client Integration Presets</h3>

      <Tabs defaultValue="antigravity" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-1 bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] p-1.5 rounded-2xl shadow-sm">
          {Object.entries(presets).map(([key, preset]) => (
            <TabsTrigger key={key} value={key} className="text-xs py-2 gap-1.5 font-medium rounded-xl data-[state=active]:bg-[#5c54a4]/10 data-[state=active]:text-[#5c54a4] dark:data-[state=active]:bg-[#2a2a2c] dark:data-[state=active]:text-white transition-all">
              {preset.logo && (
                <Image src={preset.logo} alt={preset.title} width={14} height={14} className="shrink-0" />
              )}
              <span>{preset.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(presets).map(([key, preset]) => (
          <TabsContent key={key} value={key} className="mt-3">
            <div className="rounded-[1.5rem] border border-gray-100 dark:border-white/[0.08] bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.08] gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{preset.title}</span>
                  {preset.filename && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono bg-white dark:bg-zinc-900/50 px-2 py-0.5 rounded-md border border-gray-100 dark:border-white/[0.05] text-[11px]">
                        {preset.filename}
                      </span>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 px-3 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
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

              <div className="p-4 font-mono text-xs overflow-x-auto text-gray-800 dark:text-gray-300 leading-relaxed selection:bg-[#5c54a4]/20 selection:text-[#5c54a4] dark:selection:text-indigo-300">
                <pre>{preset.code}</pre>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.08] text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between gap-2">
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
