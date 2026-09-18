/**
 * Shared MCP App bridge for all a8n widgets.
 *
 * Initializes the ext-apps `App` lifecycle with standardized
 * `ontoolinput`, `ontoolinputpartial`, `ontoolresult`, `onhostcontextchanged`,
 * and `onteardown` handlers. All handlers are registered BEFORE
 * `app.connect()` per the ext-apps SDK requirement.
 *
 * The bridge keeps the last payload it received and re-renders whenever either
 * the payload or the connection changes. Widgets previously captured the `App`
 * from `initWidget(...).then(...)`, which loses the race when a tool result
 * arrives before `connect()` resolves: the render ran with a null app, every
 * action button stayed disabled, and nothing ever re-rendered to fix it.
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
  /**
   * The connected app, or null while the host handshake is still in flight.
   * Widgets should render actions as pending rather than hiding them.
   */
  app: App | null;
  /** Set when the host handshake failed; the widget stays read-only. */
  connectionError?: string;
}

export interface WidgetController {
  /** Re-render with the payload already held, e.g. after an action. */
  rerender: () => void;
  /** The connected app, once available. */
  getApp: () => App | null;
}

/**
 * Initialize an MCP App widget with standardized lifecycle handlers.
 *
 * @param name - Widget display name (e.g. "a8n Draft Preview")
 * @param version - Widget version (should match the MCP server version)
 * @param onRender - Invoked whenever the payload or the connection changes.
 */
export function initWidget(
  name: string,
  version: string,
  onRender: (data: WidgetRenderData) => void,
): WidgetController {
  const app = new App({ name, version });

  let connectedApp: App | null = null;
  let connectionError: string | undefined;
  let latest: Omit<WidgetRenderData, "app" | "connectionError"> = {};

  const render = () => {
    onRender({ ...latest, app: connectedApp, connectionError });
  };

  const update = (
    next: Omit<WidgetRenderData, "app" | "connectionError">,
  ) => {
    latest = next;
    render();
  };

  // ── Register ALL handlers BEFORE connect() ──────────────────────

  app.ontoolinputpartial = (params) => {
    update({
      input: (params.arguments as Record<string, unknown>) ?? {},
      isPartial: true,
    });
  };

  app.ontoolinput = (params) => {
    update({
      input: (params.arguments as Record<string, unknown>) ?? {},
      isPartial: false,
    });
  };

  app.ontoolresult = (result) => {
    const meta = (result as Record<string, unknown>)?._meta as
      | Record<string, unknown>
      | undefined;
    update({
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
  app
    .connect(new PostMessageTransport(window.parent, window.parent))
    .then(() => {
      connectedApp = app;
      setupFullscreenToggle(app);
      // Re-render: a result may already have arrived while connecting, and
      // actions stay inert until the app exists.
      render();
    })
    .catch((error: unknown) => {
      connectionError =
        error instanceof Error ? error.message : "Could not reach the host app.";
      render();
    });

  // Render once immediately so the widget shows a skeleton rather than
  // an empty frame while the handshake completes.
  render();

  return {
    rerender: render,
    getApp: () => connectedApp,
  };
}

/**
 * Attach a fullscreen toggle handler using `app.requestDisplayMode()`.
 * The button stays hidden until the host says fullscreen is available.
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
      btn.removeAttribute("hidden");
    }
    if (ctx.displayMode) {
      currentMode = ctx.displayMode;
      const isFullscreen = ctx.displayMode === "fullscreen";
      btn.textContent = isFullscreen ? "Exit full screen" : "Full screen";
      btn.setAttribute("aria-pressed", String(isFullscreen));
    }
  });

  btn.addEventListener("click", async () => {
    const newMode = currentMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      const res = await app.requestDisplayMode({ mode: newMode });
      if (res.mode) currentMode = res.mode;
    } catch {
      // Host does not support the requested mode; leave the widget inline.
    }
  });
}
