/**
 * Context Budget Audit (measurement-only, always passes)
 *
 * Connects a real MCP client to the real server factory over
 * InMemoryTransport for every app profile and measures the exact
 * serialized size of tools/list, resources/list, and prompts/list
 * payloads — i.e., what an LLM host would place into model context.
 *
 * Run: npx vitest run --config vitest.config.mjs tests/mcp/contract/context-budget.test.mjs
 */
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/mcp";

let encoder = null;
async function loadTokenizer() {
  if (encoder) return encoder;
  try {
    const mod = await import(
      // js-tiktoken is a transitive dep under pnpm; resolve explicitly.
      // @ts-ignore - runtime path resolution
      "/node_modules/.pnpm/js-tiktoken@1.0.21/node_modules/js-tiktoken/dist/index.cjs"
    );
    encoder = mod.encodingForModel("gpt-4o");
  } catch {
    encoder = null;
  }
  return encoder;
}

function countTokens(text, enc) {
  if (enc) return enc.encode(text).length;
  return Math.ceil(text.length / 4);
}

async function collect(profile) {
  const server = createMcpServer(undefined, { appProfile: profile });
  const client = new Client({ name: "context-audit", version: "1.0.0" });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  const { tools } = await client.listTools();
  let resources = [];
  let prompts = [];
  try {
    resources = (await client.listResources()).resources ?? [];
  } catch {}
  try {
    prompts = (await client.listPrompts()).prompts ?? [];
  } catch {}
  await client.close();
  return { tools, resources, prompts };
}

describe("MCP context budget audit", () => {
  it("measures tools/list context cost per profile", async () => {
    const enc = await loadTokenizer();
    const report = {};

    for (const profile of ["default", "chatgpt", "embedded_agent"]) {
      const { tools, resources, prompts } = await collect(profile);
      const rows = tools.map((t) => {
        const wire = JSON.stringify({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
        return {
          name: t.name,
          chars: wire.length,
          tokens: countTokens(wire, enc),
        };
      });
      const resWire = JSON.stringify(resources);
      const prmWire = JSON.stringify(prompts);
      const totals = {
        toolCount: tools.length,
        resourceCount: resources.length,
        promptCount: prompts.length,
        toolsChars: rows.reduce((a, r) => a + r.chars, 0),
        toolsTokens: rows.reduce((a, r) => a + r.tokens, 0),
        resourcesChars: resWire.length,
        resourcesTokens: countTokens(resWire, enc),
        promptsChars: prmWire.length,
        promptsTokens: countTokens(prmWire, enc),
      };
      report[profile] = { totals, rows };
      console.log(`\n===== PROFILE: ${profile} =====`);
      console.log(
        `tools=${totals.toolCount} resources=${totals.resourceCount} prompts=${totals.promptCount}`,
      );
      console.log(
        `TOOLS   : ${totals.toolsChars} chars ~ ${totals.toolsTokens} tokens`,
      );
      console.log(
        `RESOURCES: ${totals.resourcesChars} chars ~ ${totals.resourcesTokens} tokens`,
      );
      console.log(
        `PROMPTS : ${totals.promptsChars} chars ~ ${totals.promptsTokens} tokens`,
      );
      console.log(`tokenizer: ${enc ? "js-tiktoken gpt-4o" : "chars/4 fallback"}`);
      for (const r of [...rows].sort((a, b) => b.tokens - a.tokens)) {
        console.log(
          `${String(r.tokens).padStart(6)} tok ${String(r.chars).padStart(7)} ch  ${r.name}`,
        );
      }
    }

    expect(Object.keys(report).length).toBe(3);
  });
});
