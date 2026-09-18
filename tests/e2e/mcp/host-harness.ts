/**
 * A minimal MCP Apps host, for driving widgets in tests.
 *
 * Widgets talk to their host over postMessage using the ext-apps protocol
 * (`ui/initialize`, then `ui/notifications/*`). The previous tests faked a
 * `window.openai` object instead, which stopped matching how the widgets
 * actually connect once they moved to the ext-apps SDK — so they exercised
 * nothing.
 *
 * This harness serves the built widget in an iframe and speaks the real
 * protocol to it, so a test sees what a host sees.
 */

import type { Page } from "@playwright/test";

export type HostTheme = "light" | "dark";

export interface HostOptions {
  /** Widget HTML, already built and self-contained. */
  html: string;
  /** `_meta.details` payload delivered with the tool result. */
  details?: unknown;
  /** `structuredContent` delivered with the tool result. */
  structuredContent?: Record<string, unknown>;
  /** Send the tool result, or leave the widget in its waiting state. */
  sendResult?: boolean;
  theme?: HostTheme;
  /** Viewport the iframe reports; widgets are responsive. */
  width?: number;
}

/** Calls the widget made back to the host, recorded in page order. */
export interface RecordedCall {
  name: string;
  arguments: Record<string, unknown>;
}

declare global {
  interface Window {
    __hostCalls?: RecordedCall[];
    __hostReady?: boolean;
    __pwned?: string;
  }
}

/**
 * Load a widget inside a host page and complete the handshake.
 * Resolves once the widget has been given its tool result.
 */
export async function mountWidget(page: Page, options: HostOptions): Promise<void> {
  const {
    html,
    details,
    structuredContent = {},
    sendResult = true,
    theme = "light",
    width = 420,
  } = options;

  await page.setViewportSize({ width, height: 900 });
  await page.goto("about:blank");

  await page.evaluate(
    async (input) => {
      window.__hostCalls = [];
      window.__hostReady = false;
      delete window.__pwned;

      document.body.style.margin = "0";
      document.body.style.background = input.theme === "dark" ? "#0b0d11" : "#ffffff";

      const frame = document.createElement("iframe");
      frame.id = "widget-frame";
      frame.setAttribute("srcdoc", input.html);
      frame.style.cssText = `width:${input.width}px;border:0;display:block;height:900px;`;
      document.body.appendChild(frame);

      const post = (message: unknown) => {
        frame.contentWindow?.postMessage(message, "*");
      };

      const respond = (id: unknown, result: unknown) => {
        post({ jsonrpc: "2.0", id, result });
      };

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as {
          id?: unknown;
          method?: string;
          params?: Record<string, unknown>;
        };
        if (!message || typeof message.method !== "string") return;

        switch (message.method) {
          case "ui/initialize": {
            respond(message.id, {
              protocolVersion: (message.params?.protocolVersion as string) ?? "2025-11-25",
              hostInfo: { name: "a8n-test-host", version: "1.0.0" },
              hostCapabilities: {},
              hostContext: {
                theme: input.theme,
                displayMode: "inline",
                availableDisplayModes: ["inline", "fullscreen"],
              },
            });
            break;
          }
          case "ui/notifications/initialized": {
            window.__hostReady = true;
            // Hosts send context right after the handshake.
            post({
              jsonrpc: "2.0",
              method: "ui/notifications/host-context-changed",
              params: {
                theme: input.theme,
                displayMode: "inline",
                availableDisplayModes: ["inline", "fullscreen"],
              },
            });
            break;
          }
          case "tools/call": {
            const params = (message.params ?? {}) as {
              name?: string;
              arguments?: Record<string, unknown>;
            };
            window.__hostCalls?.push({
              name: String(params.name ?? ""),
              arguments: params.arguments ?? {},
            });
            respond(message.id, {
              content: [{ type: "text", text: "ok" }],
              structuredContent: { ok: true },
            });
            break;
          }
          case "ui/request-display-mode": {
            respond(message.id, {
              mode: (message.params?.mode as string) ?? "inline",
            });
            break;
          }
          default: {
            // Requests carry an id and must be answered; notifications need not be.
            if (message.id !== undefined) respond(message.id, {});
          }
        }
      });

      // Wait for the widget to finish connecting before delivering a result.
      const deadline = Date.now() + 5000;
      while (!window.__hostReady && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      if (input.sendResult) {
        post({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            content: [{ type: "text", text: "Widget data" }],
            structuredContent: input.structuredContent,
            _meta: { details: input.details },
          },
        });
      }
    },
    { html, details, structuredContent, sendResult, theme, width },
  );

  // Give the widget a frame to render the payload.
  await page.waitForTimeout(250);
}

/** Text content of the widget document, for assertions. */
export async function widgetText(page: Page): Promise<string> {
  const frame = page.frameLocator("#widget-frame");
  return (await frame.locator("body").textContent()) ?? "";
}

/** Inner HTML of the widget document, for escaping assertions. */
export async function widgetHtml(page: Page): Promise<string> {
  const frame = page.frameLocator("#widget-frame");
  return await frame.locator("body").innerHTML();
}

/** Tool calls the widget asked the host to make. */
export async function recordedCalls(page: Page): Promise<RecordedCall[]> {
  return (await page.evaluate(() => window.__hostCalls ?? [])) as RecordedCall[];
}
