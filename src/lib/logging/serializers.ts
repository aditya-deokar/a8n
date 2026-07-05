import { normalizeError } from "@/lib/logging/errors";
import { safeHeaders, safeUrl } from "@/lib/logging/redaction";

export function serializeRequest(request: Request) {
  const url = new URL(request.url);
  return {
    method: request.method,
    url: safeUrl(request.url),
    route: url.pathname,
    headers: safeHeaders(request.headers),
  };
}

export function serializeResponse(response: Response) {
  return {
    statusCode: response.status,
    statusText: response.statusText,
    headers: safeHeaders(response.headers),
  };
}

export const serializers = {
  err: normalizeError,
  error: normalizeError,
  request: serializeRequest,
  response: serializeResponse,
};
