import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_ROUTE_URL } from "./route-client.mjs";

export function createRouteFetch(routeModule) {
  return async function routeFetch(input, init = {}) {
    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(String(input), init);
    const method = request.method.toUpperCase();

    if (method === "POST") return routeModule.POST(request);
    if (method === "GET") return routeModule.GET(request);
    if (method === "DELETE") return routeModule.DELETE(request);
    if (method === "OPTIONS") return routeModule.OPTIONS(request);

    return new Response("Unsupported test method", { status: 405 });
  };
}

export async function createMcpSdkRouteClient({
  routeModule,
  endpoint = MCP_ROUTE_URL,
  token = "test-token",
  profile,
} = {}) {
  const url = new URL(endpoint);
  if (profile) {
    url.searchParams.set("profile", profile);
  }

  const client = new Client({
    name: "a8n-mcp-route-test-client",
    version: "0.0.0",
  });
  const transport = new StreamableHTTPClientTransport(url, {
    fetch: createRouteFetch(routeModule),
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  await client.connect(transport);

  return {
    client,
    transport,
    close: async () => {
      await client.close();
    },
  };
}
