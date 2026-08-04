/**
 * Shared utility functions for all a8n MCP App widgets.
 *
 * Ported from the inline `<script>` in widget-resources.ts to proper
 * TypeScript modules for Vite bundling. Includes HTML escaping,
 * secret redaction, and DOM helper builders.
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
    .replace(
      /(api[_ -]?key|token|secret|authorization)(["':=\s]+)[^\s<>"']{8,}/gi,
      "$1$2[REDACTED]",
    );
}

/** Escape HTML after redacting secrets. */
export function html(value: unknown): string {
  return escapeHtml(safeText(value));
}

// ── DOM content builders ───────────────────────────────────────────

/** Render an ordered list from items, or "None" if empty. */
export function list(
  items: unknown[] | undefined | null,
  mapper: (item: unknown, index: number) => string,
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="subtle">None</p>';
  }
  return "<ol>" + items.map(mapper).join("") + "</ol>";
}

/** Update the status pill element. */
export function setStatus(text: string, tone?: string): void {
  const status = document.getElementById("status");
  if (!status) return;
  status.className = "pill " + (tone || "");
  status.textContent = safeText(text);
}

/** Render a titled panel section. */
export function panel(title: string, body: string): string {
  return '<div class="panel"><h2>' + html(title) + "</h2>" + body + "</div>";
}

/** Render a metric card with a large value and small label. */
export function metric(label: string, value: unknown): string {
  return (
    '<div class="metric"><strong>' +
    html(value) +
    '</strong><span class="subtle">' +
    html(label) +
    "</span></div>"
  );
}
