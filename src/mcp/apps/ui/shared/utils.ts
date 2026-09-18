/**
 * Shared rendering helpers for all a8n MCP App widgets.
 *
 * Every helper escapes and redacts before returning markup: widget payloads
 * carry user workflow data and, in the setup checklist, webhook URLs, so
 * nothing reaches innerHTML unsanitized.
 */

// ── Text sanitization ──────────────────────────────────────────────

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Redact known secret patterns from arbitrary text.
 * This prevents accidental secret leakage in widget rendering.
 */
export function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/a8n_mcp_[A-Za-z0-9._-]+/g, "[REDACTED_MCP_KEY]")
    .replace(/\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\b(?:xox[baprs]-|ghp_|AIza)[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    // Assignment-shaped only. Matching "<keyword> <any long word>" also ate
    // ordinary prose — "shared-secret verification" became "shared-secret
    // [REDACTED]" in the setup checklist.
    .replace(
      /(api[_ -]?key|token|secret|authorization)(\s*["':=]+\s*)[^\s<>"']{8,}/gi,
      "$1$2[REDACTED]",
    );
}

/** Escape HTML after redacting secrets. */
export function html(value: unknown): string {
  return escapeHtml(safeText(value));
}

// ── Status vocabulary ──────────────────────────────────────────────

export type Tone = "ok" | "warn" | "bad" | "neutral";

/** Map the various status vocabularies the server uses onto a single tone. */
export function toneForStatus(status: unknown): Tone {
  const value = String(status ?? "").toLowerCase();
  if (["success", "configured", "ready", "valid", "ok", "applied"].includes(value)) {
    return "ok";
  }
  if (["failed", "error", "invalid", "missing", "needs_diagnosis"].includes(value)) {
    return "bad";
  }
  if (["running", "unknown_running", "pending", "draft", "warn"].includes(value)) {
    return "warn";
  }
  return "neutral";
}

/** Human-readable label for the snake_case statuses the server emits. */
export function statusLabel(status: unknown): string {
  return String(status ?? "unknown").replace(/_/g, " ");
}

// ── Layout primitives ──────────────────────────────────────────────

/** Update the header status pill. */
export function setStatus(text: string, tone: Tone = "neutral"): void {
  const status = document.getElementById("status");
  if (!status) return;
  status.className = `pill pill--${tone}`;
  status.textContent = safeText(text);
}

/** Set the header title and optional subtitle. */
export function setHeader(title: string, subtitle?: string): void {
  const titleEl = document.getElementById("title");
  if (titleEl) titleEl.textContent = safeText(title);

  const subtitleEl = document.getElementById("subtitle");
  if (subtitleEl && subtitle !== undefined) {
    subtitleEl.textContent = safeText(subtitle);
  }
}

/** A titled section. `actions` renders at the right of the heading row. */
export function panel(
  title: string,
  body: string,
  options: { actions?: string; tone?: Tone } = {},
): string {
  const toneClass = options.tone ? ` panel--${options.tone}` : "";
  const actions = options.actions
    ? `<div class="panel__actions">${options.actions}</div>`
    : "";
  return `<section class="panel${toneClass}"><div class="panel__head"><h2>${html(title)}</h2>${actions}</div>${body}</section>`;
}

/** A large number with a caption. */
export function metric(label: string, value: unknown, tone: Tone = "neutral"): string {
  return `<div class="metric metric--${tone}"><strong>${html(value)}</strong><span>${html(label)}</span></div>`;
}

/** A row of metrics. */
export function metricRow(metrics: string[]): string {
  return `<div class="metrics">${metrics.join("")}</div>`;
}

/** A status pill. */
export function pill(text: unknown, tone: Tone = "neutral"): string {
  return `<span class="pill pill--${tone}">${html(statusLabel(text))}</span>`;
}

/**
 * Render items, or a placeholder when there are none. An empty list is a
 * meaningful answer ("nothing missing"), so callers pass their own wording.
 */
export function list(
  items: unknown[] | undefined | null,
  mapper: (item: unknown, index: number) => string,
  emptyMessage = "Nothing here yet.",
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="muted">${html(emptyMessage)}</p>`;
  }
  return `<ul class="stack-list">${items.map(mapper).join("")}</ul>`;
}

/** A numbered step rail, used by the draft preview and execution timeline. */
export function steps(
  items: unknown[] | undefined | null,
  mapper: (item: unknown, index: number) => { title: string; meta?: string; trailing?: string; tone?: Tone },
  emptyMessage = "No steps yet.",
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="muted">${html(emptyMessage)}</p>`;
  }

  const rows = items
    .map((item, index) => {
      const step = mapper(item, index);
      const tone = step.tone ?? "neutral";
      const meta = step.meta ? `<span class="step__meta">${html(step.meta)}</span>` : "";
      const trailing = step.trailing ? `<div class="step__trailing">${step.trailing}</div>` : "";
      return `<li class="step step--${tone}">
        <span class="step__marker" aria-hidden="true">${index + 1}</span>
        <div class="step__body">
          <span class="step__title">${html(step.title)}</span>
          ${meta}
        </div>
        ${trailing}
      </li>`;
    })
    .join("");

  return `<ol class="steps">${rows}</ol>`;
}

/** Definition-style key/value rows. */
export function keyValues(rows: Array<[string, string]>): string {
  return `<dl class="kv">${rows
    .map(([key, value]) => `<dt>${html(key)}</dt><dd>${value}</dd>`)
    .join("")}</dl>`;
}

/** Copy-friendly monospace value. */
export function code(value: unknown): string {
  return `<code class="code">${html(value)}</code>`;
}

// ── States ─────────────────────────────────────────────────────────

/** Placeholder shown while the host is still sending data. */
export function skeleton(lines = 3): string {
  const rows = Array.from({ length: lines }, () => '<span class="skeleton__line"></span>').join("");
  return `<section class="panel" aria-busy="true" aria-live="polite"><div class="skeleton">${rows}</div></section>`;
}

/** Shown when the widget has no data and is not waiting for any. */
export function emptyState(title: string, message: string): string {
  return `<section class="panel state"><p class="state__title">${html(title)}</p><p class="muted">${html(message)}</p></section>`;
}

/** Shown when the widget cannot render, e.g. the host handshake failed. */
export function errorState(title: string, message: string): string {
  return `<section class="panel panel--bad state" role="alert"><p class="state__title">${html(title)}</p><p class="muted">${html(message)}</p></section>`;
}

/** Primary action button. Disabled until the host connection exists. */
export function actionButton(
  id: string,
  label: string,
  options: { disabled?: boolean; variant?: "primary" | "secondary"; hint?: string } = {},
): string {
  const variant = options.variant ?? "primary";
  const disabled = options.disabled ? " disabled" : "";
  const hint = options.hint
    ? `<span class="action__hint">${html(options.hint)}</span>`
    : "";
  return `<div class="action"><button id="${html(id)}" type="button" class="btn btn--${variant}"${disabled}>${html(label)}</button>${hint}</div>`;
}

/**
 * Bind a click handler that reports its own progress on the button.
 *
 * Widgets re-render by replacing innerHTML, so handlers must be re-bound after
 * every render; the bound flag keeps a re-render from stacking listeners on a
 * button that survived.
 */
export function bindAction(
  id: string,
  handler: () => Promise<void>,
  labels: { idle: string; busy: string; done: string },
): void {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (!button || button.dataset.bound === "true") return;
  button.dataset.bound = "true";

  button.addEventListener("click", async () => {
    const wasDisabled = button.disabled;
    button.disabled = true;
    button.textContent = labels.busy;
    try {
      await handler();
      button.textContent = labels.done;
      button.classList.add("btn--done");
    } catch (error) {
      button.textContent = labels.idle;
      button.disabled = wasDisabled;
      const hint = button.parentElement?.querySelector(".action__hint");
      if (hint) {
        hint.textContent = safeText(
          error instanceof Error ? error.message : "That did not work. Try again.",
        );
        hint.classList.add("action__hint--error");
      }
    }
  });
}
