import { registerOAuthClient } from "@/mcp/auth/oauth.service";

export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

function errorResponse(error: string, status = 400): Response {
  return Response.json(
    {
      error: status === 403 ? "access_denied" : "invalid_client_metadata",
      error_description: error,
    },
    { status, headers: corsHeaders() },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const client = await registerOAuthClient(body);
    return Response.json(client, {
      status: 201,
      headers: corsHeaders(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth client registration failed.";
    return errorResponse(message, message.includes("disabled") ? 403 : 400);
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
