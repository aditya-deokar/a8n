"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import Image from "next/image";

type Preset = {
  title: string;
  logo?: string;
  /** What the snippet is and how it authenticates. */
  desc: string;
  /** Where the snippet goes, when it is a file. */
  filename?: string;
  /** The snippet itself. Must be valid, pasteable content on its own. */
  code: string;
  /** Extra guidance rendered under the snippet. */
  notes?: string[];
  docsUrl?: string;
};

export const McpClientConfigs = () => {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const presets = useMemo<Record<string, Preset>>(() => {
    // Some clients resolve "localhost" to ::1 while the dev server listens on
    // 127.0.0.1, which fails to connect with no useful error.
    const endpointUrl = origin.includes("localhost")
      ? `${origin.replace("localhost", "127.0.0.1")}/api/mcp`
      : `${origin}/api/mcp`;

    const remoteStdioConfig = (withApiKey: boolean) =>
      JSON.stringify(
        {
          mcpServers: {
            a8n: {
              command: "npx",
              args: ["-y", "mcp-remote", endpointUrl],
              ...(withApiKey
                ? { env: { MCP_HEADERS: "Authorization: Bearer a8n_mcp_<your_api_key>" } }
                : {}),
            },
          },
        },
        null,
        2,
      );

    return {
      claude: {
        title: "Claude",
        logo: "/logos/anthropic.svg",
        desc: "Claude Code connects to the endpoint directly. Claude Desktop needs the mcp-remote bridge.",
        filename: "claude_desktop_config.json",
        // One command for Claude Code, one file for Claude Desktop — each is
        // valid on its own, unlike a JSON blob with comments pasted in.
        code: `claude mcp add --transport http a8n ${endpointUrl}`,
        notes: [
          "Claude Code: run the command above. It opens a browser for OAuth on first use.",
          `Claude Desktop: put the JSON below in claude_desktop_config.json.\n\n${remoteStdioConfig(false)}`,
          `To use an API key instead of OAuth, add an env block:\n\n${remoteStdioConfig(true)}`,
        ],
        docsUrl: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
      },
      cursor: {
        title: "Cursor",
        desc: "Streamable HTTP with an API key in the Authorization header.",
        filename: ".cursor/mcp.json",
        code: JSON.stringify(
          {
            mcpServers: {
              a8n: {
                url: endpointUrl,
                headers: {
                  Authorization: "Bearer a8n_mcp_<your_api_key>",
                },
              },
            },
          },
          null,
          2,
        ),
        notes: ["Generate a scoped key above and paste it in place of the placeholder."],
      },
      vscode: {
        title: "VS Code",
        desc: "GitHub Copilot agent mode reads MCP servers from this workspace file.",
        filename: ".vscode/mcp.json",
        code: JSON.stringify(
          {
            servers: {
              a8n: {
                type: "http",
                url: endpointUrl,
              },
            },
          },
          null,
          2,
        ),
        notes: [
          "VS Code runs the OAuth flow on first connect; no key needs to be stored in the file.",
        ],
        docsUrl: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
      },
      antigravity: {
        title: "Antigravity",
        logo: "/logos/gemini.svg",
        desc: "Connects over OAuth through the mcp-remote bridge. No API key needed.",
        filename: "mcp_config.json",
        code: remoteStdioConfig(false),
        notes: [
          `To use an API key instead of OAuth:\n\n${remoteStdioConfig(true)}`,
        ],
      },
      chatgpt: {
        title: "ChatGPT",
        desc: "Added as a remote MCP connector. ChatGPT runs the OAuth flow itself.",
        code: endpointUrl,
        notes: [
          "Settings → Connectors → Add: paste the URL above as the MCP server URL.",
          `Authorization is discovered automatically from ${origin}/.well-known/oauth-protected-resource`,
          "Add ?profile=chatgpt to the URL to expose the reduced, app-safe tool set.",
        ],
      },
      inspector: {
        title: "MCP Inspector",
        desc: "The official debugging client for tools, resources, and prompts.",
        code: "npx @modelcontextprotocol/inspector",
        notes: [
          "Transport: Streamable HTTP",
          `URL: ${endpointUrl}`,
          "Header: Authorization: Bearer a8n_mcp_<your_api_key>",
        ],
        docsUrl: "https://github.com/modelcontextprotocol/inspector",
      },
    };
  }, [origin]);

  const handleCopy = async (tabKey: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedTab(tabKey);
      setCopyFailed(false);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      // Not available on plain HTTP; the snippet is selectable regardless.
      setCopyFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-1">
        Client integration presets
      </h3>

      <Tabs defaultValue="claude" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full h-auto gap-1 bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] p-1.5 rounded-2xl shadow-sm">
          {Object.entries(presets).map(([key, preset]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs py-2 gap-1.5 font-medium rounded-xl data-[state=active]:bg-[#5c54a4]/10 data-[state=active]:text-[#5c54a4] dark:data-[state=active]:bg-[#2a2a2c] dark:data-[state=active]:text-white transition-all"
            >
              {preset.logo && (
                <Image
                  src={preset.logo}
                  alt=""
                  width={14}
                  height={14}
                  className="shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{preset.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(presets).map(([key, preset]) => (
          <TabsContent key={key} value={key} className="mt-3">
            <div className="rounded-[1.5rem] border border-gray-100 dark:border-white/[0.08] bg-white/40 dark:bg-[#111111]/80 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.08] gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {preset.title}
                  </span>
                  {preset.filename && (
                    <>
                      <span aria-hidden="true">&bull;</span>
                      <span className="font-mono bg-white dark:bg-zinc-900/50 px-2 py-0.5 rounded-md border border-gray-100 dark:border-white/[0.05] text-[11px] truncate">
                        {preset.filename}
                      </span>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 px-3 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 shrink-0"
                  onClick={() => handleCopy(key, preset.code)}
                  aria-label={`Copy the ${preset.title} snippet`}
                >
                  {copiedTab === key ? (
                    <>
                      <CheckIcon className="size-3 text-emerald-500" aria-hidden="true" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" aria-hidden="true" />
                      <span>Copy snippet</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="p-4 font-mono text-xs overflow-x-auto text-gray-800 dark:text-gray-300 leading-relaxed selection:bg-[#5c54a4]/20">
                <pre className="whitespace-pre">{preset.code}</pre>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 dark:border-white/[0.08] text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span>{preset.desc}</span>
                  {preset.docsUrl && (
                    <a
                      href={preset.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium shrink-0"
                    >
                      <span>Docs</span>
                      <ExternalLinkIcon className="size-2.5" aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
                {preset.notes && preset.notes.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {preset.notes.map((note) => (
                      <li key={note} className="whitespace-pre-wrap">
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {copyFailed && (
        <p className="text-xs text-amber-600 dark:text-amber-500 ml-1">
          Copying needs a secure (https) page. Select the snippet and copy it manually.
        </p>
      )}
    </div>
  );
};
