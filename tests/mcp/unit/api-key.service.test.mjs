import { describe, expect, it } from "vitest";
import {
  generateRawApiKey,
  getKeyPrefix,
  hashApiKey,
} from "@/mcp/auth/api-key.service";
import { MCP_CONFIG } from "@/mcp/config";

function restoreEnv(name, previous) {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
}

describe("MCP API key helpers", () => {
  it("generates prefixed keys with configured random length", () => {
    const key = generateRawApiKey();

    expect(key.startsWith(MCP_CONFIG.API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBe(MCP_CONFIG.API_KEY_PREFIX.length + MCP_CONFIG.API_KEY_LENGTH);
  });

  it("returns only the display prefix", () => {
    const key = `${MCP_CONFIG.API_KEY_PREFIX}abcdefghijklmnopqrstuvwxyz`;

    expect(getKeyPrefix(key)).toBe(`${MCP_CONFIG.API_KEY_PREFIX}abcdefgh`);
  });

  it("hashes deterministically with the configured HMAC secret", () => {
    const previous = process.env.MCP_API_KEY_HMAC_SECRET;
    process.env.MCP_API_KEY_HMAC_SECRET = "unit-test-hmac-secret-32-characters";
    const left = hashApiKey("a8n_mcp_test_key");
    const right = hashApiKey("a8n_mcp_test_key");
    restoreEnv("MCP_API_KEY_HMAC_SECRET", previous);

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });
});
