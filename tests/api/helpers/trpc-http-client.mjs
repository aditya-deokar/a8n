import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { vi } from "vitest";
import { installApiModuleMocks } from "./trpc-caller.mjs";

const trpcUrl = "http://127.0.0.1/api/trpc";

export async function loadTrpcRouteHandlers() {
  vi.resetModules();
  installApiModuleMocks();
  return import("@/app/api/trpc/[trpc]/route");
}

export async function createRouteFetchRecorder() {
  const handlers = await loadTrpcRouteHandlers();
  const requests = [];

  const fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());

    if (request.method === "GET") {
      return handlers.GET(request);
    }

    return handlers.POST(request);
  };

  return { fetch, handlers, requests };
}

export async function createHttpTrpcClient() {
  const recorder = await createRouteFetchRecorder();
  const client = createTRPCClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        fetch: recorder.fetch,
      }),
    ],
  });

  return { client, ...recorder };
}

export async function callTrpcRoute({
  path,
  method = "POST",
  body,
  headers,
  search = "",
}) {
  const handlers = await loadTrpcRouteHandlers();
  const request = new Request(`${trpcUrl}/${path}${search}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body,
  });

  if (method === "GET") {
    return handlers.GET(request);
  }

  return handlers.POST(request);
}
