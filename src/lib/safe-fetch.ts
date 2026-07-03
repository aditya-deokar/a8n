import { checkEgressUrlSafety } from "@/mcp/safety/egress-policy";

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = RequestInit & {
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  retries?: number;
  allowedDomains?: string[];
  allowlistMode?: boolean;
  userAgentSuffix?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_RETRIES = 0;

const DEFAULT_PROVIDER_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "oauth2.googleapis.com",
  "sheets.googleapis.com",
  "slack.com",
  "hooks.slack.com",
  "discord.com",
  "discordapp.com",
  "api.stripe.com",
];

function configuredAllowlistDomains(): string[] {
  return (process.env.MCP_SAFE_FETCH_ALLOWLIST_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowlistMode(options: SafeFetchOptions): boolean {
  return options.allowlistMode ?? process.env.MCP_SAFE_FETCH_ALLOWLIST_MODE === "true";
}

function domainMatches(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

export function isSafeFetchDomainAllowed(
  hostname: string,
  allowedDomains: string[] = [],
): boolean {
  const domains = [
    ...DEFAULT_PROVIDER_DOMAINS,
    ...configuredAllowlistDomains(),
    ...allowedDomains,
  ];
  return domains.some((domain) => domainMatches(hostname, domain));
}

function assertUrlAllowed(rawUrl: string, options: SafeFetchOptions): URL {
  const egress = checkEgressUrlSafety(rawUrl);
  if (!egress.allowed) {
    throw new SafeFetchError(
      `Outbound request blocked: ${egress.reason}.`,
      egress.reason,
      egress.normalizedUrl || rawUrl,
    );
  }

  const url = new URL(egress.normalizedUrl || rawUrl);
  if (isAllowlistMode(options) && !isSafeFetchDomainAllowed(url.hostname, options.allowedDomains)) {
    throw new SafeFetchError(
      "Outbound request blocked: host is not in the MCP safe-fetch allowlist.",
      "blocked-domain-not-allowlisted",
      url.toString(),
    );
  }

  return url;
}

function mergeHeaders(headers: HeadersInit | undefined, suffix?: string): Headers {
  const merged = new Headers(headers);
  if (!merged.has("User-Agent")) {
    const userAgent = suffix ? `a8n-mcp-safe-fetch ${suffix}` : "a8n-mcp-safe-fetch";
    merged.set("User-Agent", userAgent);
  }
  return merged;
}

async function responseWithBoundedBody(
  response: Response,
  maxResponseBytes: number,
): Promise<Response> {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxResponseBytes) {
      await reader.cancel();
      throw new SafeFetchError(
        "Outbound response exceeded the configured MCP safe-fetch size limit.",
        "response-too-large",
        response.url,
      );
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function fetchWithRedirectChecks(
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const headers = mergeHeaders(options.headers, options.userAgentSuffix);
  let currentUrl = assertUrlAllowed(rawUrl, options);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(currentUrl, {
        ...options,
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return responseWithBoundedBody(response, maxResponseBytes);
        if (redirectCount === maxRedirects) {
          throw new SafeFetchError(
            "Outbound request exceeded the MCP safe-fetch redirect limit.",
            "too-many-redirects",
            currentUrl.toString(),
          );
        }
        currentUrl = assertUrlAllowed(new URL(location, currentUrl).toString(), options);
        continue;
      }

      return responseWithBoundedBody(response, maxResponseBytes);
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      if ((error as { name?: string }).name === "AbortError") {
        throw new SafeFetchError(
          "Outbound request timed out.",
          "timeout",
          currentUrl.toString(),
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SafeFetchError(
    "Outbound request exceeded the MCP safe-fetch redirect limit.",
    "too-many-redirects",
    currentUrl.toString(),
  );
}

export async function safeFetch(
  rawUrl: string | URL,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetchWithRedirectChecks(rawUrl.toString(), options);
      if (attempt < retries && (response.status === 429 || response.status >= 500)) {
        attempt++;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof SafeFetchError || attempt >= retries) throw error;
      attempt++;
    }
  }

  throw lastError;
}
