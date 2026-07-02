export const MCP_ROUTE_URL = "http://127.0.0.1:3000/api/mcp";

export function mcpRouteUrl({ profile } = {}) {
  const url = new URL(MCP_ROUTE_URL);
  if (profile) {
    url.searchParams.set("profile", profile);
  }
  return url.toString();
}

export function mcpJsonRpcBody({ id = 1, method = "tools/list", params = {} } = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

export function createMcpPostRequest({
  id = 1,
  method = "tools/list",
  params = {},
  token = "test-token",
  profile,
  origin,
  headers = {},
  body,
} = {}) {
  const requestHeaders = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    ...headers,
  });

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (origin) {
    requestHeaders.set("Origin", origin);
  }

  return new Request(mcpRouteUrl({ profile }), {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body ?? mcpJsonRpcBody({ id, method, params })),
  });
}

export function createOptionsRequest({ origin, profile } = {}) {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }

  return new Request(mcpRouteUrl({ profile }), {
    method: "OPTIONS",
    headers,
  });
}

export async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function callMcpJson(routeModule, requestOptions = {}) {
  const response = await routeModule.POST(createMcpPostRequest(requestOptions));
  return {
    response,
    json: await readJson(response),
  };
}

export function toolNamesFromListResponse(payload) {
  return (payload?.result?.tools ?? []).map((tool) => tool.name).sort();
}
