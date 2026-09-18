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

import { protectedResourceMetadata } from "@/mcp/auth/oauth.service";

// Route segment config has to be declared in the file that uses it. Next.js
// parses it statically and rejects a re-export, so this cannot be pulled in
// from the root route alongside the handlers.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return Response.json(protectedResourceMetadata(request), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
