import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  html,
  safeText,
  statusLabel,
  toneForStatus,
} from "@/mcp/apps/ui/shared/utils";

describe("widget text sanitization", () => {
  it("escapes markup so payload text cannot become live nodes", () => {
    const escaped = escapeHtml(`<img src=x onerror="alert(1)">`);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("&quot;");
  });

  it("redacts a8n MCP keys and provider secrets", () => {
    expect(safeText("use a8n_mcp_abc123DEF456")).toContain("[REDACTED_MCP_KEY]");
    expect(safeText("key sk-live-abcdef123456")).toContain("[REDACTED_SECRET]");
    expect(safeText("slack xoxb-11111-22222")).toContain("[REDACTED_SECRET]");
    expect(safeText("Authorization: Bearer abc.def.ghi")).toContain("Bearer [REDACTED]");
  });

  it("redacts assignment-shaped credentials", () => {
    expect(safeText(`api_key="supersecretvalue"`)).toContain("[REDACTED]");
    expect(safeText("token=abcdefghijkl")).toContain("[REDACTED]");
    expect(safeText("secret: hunter2hunter2")).toContain("[REDACTED]");
  });

  it("leaves ordinary prose about secrets intact", () => {
    // Regression: the previous pattern matched "<keyword> <any long word>",
    // so setup guidance came out mangled in the checklist widget.
    const guidance =
      "Set GOOGLE_FORM_WEBHOOK_SECRET for shared-secret verification.";
    expect(safeText(guidance)).toBe(guidance);

    const advice = "Rotate this token periodically for safety.";
    expect(safeText(advice)).toBe(advice);
  });

  it("redacts before escaping so secrets never reach the DOM string", () => {
    const rendered = html(`<b>a8n_mcp_zzz999</b>`);
    expect(rendered).not.toContain("a8n_mcp_zzz999");
    expect(rendered).not.toContain("<b>");
  });
});

describe("widget status vocabulary", () => {
  it("maps server statuses onto a single tone vocabulary", () => {
    expect(toneForStatus("SUCCESS")).toBe("ok");
    expect(toneForStatus("configured")).toBe("ok");
    expect(toneForStatus("FAILED")).toBe("bad");
    expect(toneForStatus("needs_diagnosis")).toBe("bad");
    expect(toneForStatus("missing")).toBe("bad");
    expect(toneForStatus("unknown_running")).toBe("warn");
    expect(toneForStatus("something-else")).toBe("neutral");
    expect(toneForStatus(undefined)).toBe("neutral");
  });

  it("renders snake_case statuses as readable labels", () => {
    expect(statusLabel("needs_diagnosis")).toBe("needs diagnosis");
    expect(statusLabel(undefined)).toBe("unknown");
  });
});
