/**
 * Path-scoped protected-resource metadata.
 *
 * RFC 9728 clients — including the MCP SDK's own auth flow — probe
 * `/.well-known/oauth-protected-resource/<resource path>` first and only fall
 * back to the root document on a 4xx. Without this route every client paid a
 * 404 round-trip before discovering OAuth.
 *
 * It serves the same document as the root route; `isAllowedOAuthResource`
 * already accepts both the origin and the `/api/mcp` form, so this is additive.
 */

export { GET, OPTIONS, dynamic } from "../../route";
