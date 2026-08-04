/**
 * Shared MCP App bridge for all a8n widgets.
 *
 * Initializes the ext-apps `App` lifecycle with standardized
 * `ontoolinput`, `ontoolinputpartial`, `ontoolresult`, `onhostcontextchanged`,
 * and `onteardown` handlers. All handlers are registered BEFORE
 * `app.connect()` per the ext-apps SDK requirement.
 */

import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";

/** Data passed to the widget render callback. */
export interface WidgetRenderData {
  /** Tool arguments from `ontoolinput` or `ontoolinputpartial`. */
  input?: Record<string, unknown>;
  /** Structured result from `ontoolresult`. */
  result?: Record<string, unknown>;
  /** UI-only details from `_meta.details`. */
  details?: Record<string, unknown>;
  /** Whether the input is currently being streamed (partial). */
  isPartial?: boolean;
}

/**
 * Initialize an MCP App widget with standardized lifecycle handlers.
 *
 * @param name - Widget display name (e.g. "a8n Draft Preview")
 * @param version - Widget version (should match the MCP server version)
 * @param onRender - Callback invoked when the widget receives data to render.
 *   Called on `ontoolinput`, `ontoolinputpartial`, and `ontoolresult` events.
 * @returns The connected `App` instance for calling server tools via
 *   `app.callServerTool()`.
 */
export async function initWidget(
  name: string,
  version: string,
  onRender: (data: WidgetRenderData) => void,
): Promise<App> {
  const app = new App({ name, version });

  // ── Register ALL handlers BEFORE connect() ──────────────────────

  app.ontoolinputpartial = (params) => {
    onRender({
      input: (params.arguments as Record<string, unknown>) ?? {},
      isPartial: true,
    });
  };

  app.ontoolinput = (params) => {
    onRender({
      input: (params.arguments as Record<string, unknown>) ?? {},
      isPartial: false,
    });
  };

  app.ontoolresult = (result) => {
    const meta = (result as Record<string, unknown>)?._meta as
      | Record<string, unknown>
      | undefined;
    onRender({
      result: (result.structuredContent as Record<string, unknown>) ?? {},
      details: (meta?.details as Record<string, unknown>) ?? {},
      isPartial: false,
    });
  };

  app.onhostcontextchanged = (ctx) => {
    if (ctx.theme) applyDocumentTheme(ctx.theme);
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
    if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    if (ctx.safeAreaInsets) {
      const { top, right, bottom, left } = ctx.safeAreaInsets;
      document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }
    if (ctx.displayMode) {
      document.body.classList.toggle(
        "fullscreen",
        ctx.displayMode === "fullscreen",
      );
    }
  };

  app.onteardown = async () => ({});

  // ── Connect ─────────────────────────────────────────────────────
  await app.connect(new PostMessageTransport(window.parent, window.parent));
  return app;
}

/**
 * Helper to attach a fullscreen toggle button handler using `app.requestDisplayMode()`.
 */
export function setupFullscreenToggle(
  app: App,
  buttonId: string = "fullscreenBtn",
): void {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  let currentMode: "inline" | "fullscreen" | "pip" = "inline";

  app.addEventListener("hostcontextchanged", (ctx) => {
    if (ctx.availableDisplayModes?.includes("fullscreen")) {
      btn.style.display = "inline-flex";
    }
    if (ctx.displayMode) {
      currentMode = ctx.displayMode;
      btn.textContent =
        ctx.displayMode === "fullscreen" ? "Exit Fullscreen" : "Fullscreen";
    }
  });

  btn.addEventListener("click", async () => {
    const newMode = currentMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      const res = await app.requestDisplayMode({ mode: newMode });
      if (res.mode) currentMode = res.mode;
    } catch {
      // Host un-support or refusal fallback
    }
  });
}
