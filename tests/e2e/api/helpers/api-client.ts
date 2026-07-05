import type { APIRequestContext } from "@playwright/test";

export async function postRawJson(
  request: APIRequestContext,
  path: string,
  body: string,
  headers: Record<string, string> = {},
) {
  return request.post(path, {
    data: Buffer.from(body, "utf8"),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

export async function postTrpcJson(
  request: APIRequestContext,
  procedurePath: string,
  input: unknown,
) {
  return postRawJson(
    request,
    `/api/trpc/${procedurePath}`,
    JSON.stringify({ json: input }),
  );
}
