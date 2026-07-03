import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { APIRequestContext } from "@playwright/test";
import superjson from "superjson";
import type { AppRouter } from "../../../../src/trpc/routers/_app";

function baseURL() {
  return process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
}

function headersToRecord(headersInit: HeadersInit | undefined) {
  if (!headersInit) return undefined;

  const headers = new Headers(headersInit);
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

async function playwrightFetch(request: APIRequestContext, input: RequestInfo | URL, init?: RequestInit) {
  const url = input instanceof Request ? input.url : input.toString();
  const response = await request.fetch(url, {
    method: init?.method,
    headers: headersToRecord(init?.headers),
    data: init?.body as string | Buffer | undefined,
  });
  const headers = new Headers();

  for (const header of response.headersArray()) {
    headers.append(header.name, header.value);
  }

  return new Response(await response.text(), {
    status: response.status(),
    statusText: response.statusText(),
    headers,
  });
}

export function createE2ETrpcClient(request: APIRequestContext) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseURL().replace(/\/$/, "")}/api/trpc`,
        transformer: superjson,
        fetch: (input, init) => playwrightFetch(request, input, init),
      }),
    ],
  });
}
