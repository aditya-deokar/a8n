/**
 * Vite build configuration for MCP Apps widget UIs.
 *
 * Produces 4 self-contained HTML files in `dist/mcp-apps/` using
 * vite-plugin-singlefile. Each widget is built as a separate entry
 * because vite-plugin-singlefile disables code-splitting.
 *
 * Run:  pnpm build:mcp-apps-ui
 *
 * This script builds all 4 widgets sequentially by invoking Vite's
 * build API. The `build:mcp-apps-ui` script in package.json calls
 * this via `tsx`.
 */

import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHATGPT_WIDGET_CSP } from "../src/mcp/apps/widget-resources";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const UI_ROOT = path.resolve(PROJECT_ROOT, "src/mcp/apps/ui");
const OUT_DIR = path.resolve(PROJECT_ROOT, "dist/mcp-apps");

const WIDGETS = [
  "workflow-draft-preview",
  "workflow-setup-checklist",
  "execution-timeline",
  "workflow-approval",
];

/**
 * Widgets run as untrusted HTML inside a host surface. The CSP that the
 * widget resource advertises has to be in the document itself — declaring the
 * constant alone did nothing, and the widget shipped with no CSP at all.
 */
async function injectCsp(htmlPath: string) {
  const html = await fs.readFile(htmlPath, "utf-8");
  if (html.includes("Content-Security-Policy")) return;

  const meta = `<meta http-equiv="Content-Security-Policy" content="${CHATGPT_WIDGET_CSP}" />`;
  const withMeta = html.replace(/<head>/, `<head>
    ${meta}`);
  if (withMeta === html) {
    throw new Error(`Could not inject CSP into ${htmlPath}: no <head> found.`);
  }

  await fs.writeFile(htmlPath, withMeta, "utf-8");
}

async function buildAll() {
  for (const widget of WIDGETS) {
    const widgetDir = path.resolve(UI_ROOT, widget);
    const entry = path.resolve(widgetDir, "mcp-app.html");
    console.log(`\n📦 Building widget: ${widget}`);
    await build({
      configFile: false,
      root: widgetDir,
      plugins: [viteSingleFile()],
      build: {
        outDir: OUT_DIR,
        emptyOutDir: false,
        modulePreload: false,
        rollupOptions: {
          input: entry,
        },
      },
      logLevel: "warn",
    });

    const generatedHtml = path.resolve(OUT_DIR, "mcp-app.html");
    const targetHtml = path.resolve(OUT_DIR, `${widget}.html`);
    if (await fs.stat(generatedHtml).catch(() => null)) {
      await fs.rename(generatedHtml, targetHtml);
      await injectCsp(targetHtml);
    }
  }

  console.log(`\n✅ All ${WIDGETS.length} MCP App widgets built → ${OUT_DIR}\n`);
}

buildAll().catch((err) => {
  console.error("❌ MCP Apps UI build failed:", err);
  process.exit(1);
});
