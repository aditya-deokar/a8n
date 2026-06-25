import { oauthMetadata } from "@/mcp/auth/oauth.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return Response.json(oauthMetadata(request), {
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
