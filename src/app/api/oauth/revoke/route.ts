import { revokeOAuthToken } from "@/mcp/auth/oauth.service";

export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

export async function POST(request: Request): Promise<Response> {
  const params = new URLSearchParams(await request.text());
  const token = params.get("token");
  if (token) {
    await revokeOAuthToken(token);
  }

  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
