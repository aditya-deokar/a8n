import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { MCP_CONFIG } from "@/mcp/config";
import {
  MCP_SCOPES,
  type McpScope,
} from "./scopes";
import type { AuthResult, McpAuthInfo } from "./types";

const CHATGPT_APP_SCOPES: McpScope[] = [
  "workflows:read",
  "workflows:write",
  "workflows:execute",
  "credentials:read",
  "executions:read",
  "system:read",
];

const DEFAULT_REDIRECT_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "localhost",
  "127.0.0.1",
]);

const LOCAL_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const ALLOWED_GRANT_TYPES = new Set(["authorization_code", "refresh_token"]);
const ALLOWED_RESPONSE_TYPES = new Set(["code"]);

type OAuthClientInput = {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  scope?: unknown;
};

export type OAuthAuthorizeParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope: McpScope[];
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  resource: string;
};

type IssueAuthorizationCodeParams = OAuthAuthorizeParams & {
  userId: string;
};

type ExchangeAuthorizationCodeParams = {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource?: string;
};

type RefreshAccessTokenParams = {
  refreshToken: string;
  clientId: string;
  resource?: string;
};

type OAuthRedirectValidation = {
  ok: boolean;
  reason: string;
  match: "exact" | "development-host" | "none";
};

function randomToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function hashLegacy(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashOAuthSecret(value: string): string {
  const secret = process.env.MCP_OAUTH_TOKEN_HMAC_SECRET || process.env.MCP_API_KEY_HMAC_SECRET;
  if (secret) {
    return createHmac("sha256", secret).update(value).digest("hex");
  }

  return hashLegacy(value);
}

function oauthHashCandidates(value: string): string[] {
  return [...new Set([hashOAuthSecret(value), hashLegacy(value)])];
}

function appOriginFromEnv(): string {
  return (
    process.env.MCP_OAUTH_ISSUER ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getOAuthIssuer(request?: Request): string {
  if (process.env.MCP_OAUTH_ISSUER) {
    return process.env.MCP_OAUTH_ISSUER.replace(/\/$/, "");
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return appOriginFromEnv();
}

export function getOAuthResource(request?: Request): string {
  return (process.env.MCP_OAUTH_RESOURCE || getOAuthIssuer(request)).replace(/\/$/, "");
}

function configuredRedirectUris(): string[] {
  return (process.env.MCP_OAUTH_REDIRECT_URIS || "")
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

function configuredRedirectHosts(): Set<string> {
  const hosts = new Set(DEFAULT_REDIRECT_HOSTS);
  for (const uri of configuredRedirectUris()) {
    try {
      hosts.add(new URL(uri).hostname);
    } catch {
      // Ignore invalid env values here; validation happens on exact URI checks.
    }
  }
  return hosts;
}

function hasWildcard(value: string): boolean {
  return value.includes("*") || value.includes("{") || value.includes("}");
}

function parseRedirectUri(value: string): URL {
  if (hasWildcard(value)) {
    throw new Error("redirect_uri cannot contain wildcards or template placeholders.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("redirect_uri must be a valid absolute URL.");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("redirect_uri must use http or https.");
  }

  return url;
}

function isLocalRedirectUrl(url: URL): boolean {
  return LOCAL_REDIRECT_HOSTS.has(url.hostname.toLowerCase());
}

function isAllowedRegistrationRedirectUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (url.protocol === "https:" && configuredRedirectHosts().has(hostname)) {
    return true;
  }

  return process.env.NODE_ENV !== "production" && isLocalRedirectUrl(url);
}

function exactRedirectRequired(): boolean {
  return MCP_CONFIG.OAUTH_EXACT_REDIRECT_URIS;
}

export function validateOAuthRedirectUri(
  redirectUri: string,
  allowedUris: string[],
  options: {
    exactOnly?: boolean;
    configuredUris?: string[];
    allowDevelopmentHostFallback?: boolean;
  } = {},
): OAuthRedirectValidation {
  const exactAllowed = [...new Set([...(options.configuredUris || configuredRedirectUris()), ...allowedUris])];

  for (const uri of exactAllowed) {
    if (hasWildcard(uri)) {
      return { ok: false, reason: "configured redirect_uri contains a wildcard", match: "none" };
    }
  }

  const url = parseRedirectUri(redirectUri);
  if (exactAllowed.includes(redirectUri)) {
    return { ok: true, reason: "exact redirect_uri match", match: "exact" };
  }

  const exactOnly = options.exactOnly ?? exactRedirectRequired();
  if (exactOnly) {
    return { ok: false, reason: "redirect_uri must exactly match a registered URI", match: "none" };
  }

  const allowDevelopmentHostFallback = options.allowDevelopmentHostFallback ?? process.env.NODE_ENV !== "production";
  if (!allowDevelopmentHostFallback) {
    return { ok: false, reason: "redirect_uri host fallback is disabled", match: "none" };
  }

  if (configuredRedirectHosts().has(url.hostname) && (url.protocol === "https:" || isLocalRedirectUrl(url))) {
    return { ok: true, reason: "development redirect host match", match: "development-host" };
  }

  return { ok: false, reason: "redirect_uri host is not allowed", match: "none" };
}

function allowedResourceCandidates(request?: Request): Set<string> {
  const resource = getOAuthResource(request);
  const issuer = getOAuthIssuer(request);
  return new Set([
    resource,
    issuer,
    `${issuer}/api/mcp`,
    `${resource}/api/mcp`,
  ].map((value) => value.replace(/\/$/, "")));
}

export function isAllowedOAuthResource(resource: string, request?: Request): boolean {
  return allowedResourceCandidates(request).has(resource.replace(/\/$/, ""));
}

export function normalizeRequestedResource(resource: string | null, request?: Request): string {
  const normalized = (resource || getOAuthResource(request)).replace(/\/$/, "");
  if (!isAllowedOAuthResource(normalized, request)) {
    throw new Error(`Unsupported OAuth resource: ${normalized}`);
  }

  return normalized;
}

export function supportedOAuthScopes(): McpScope[] {
  return CHATGPT_APP_SCOPES;
}

export function parseOAuthScopes(scope?: string | null): McpScope[] {
  if (!scope?.trim()) return CHATGPT_APP_SCOPES;

  const requested = scope.split(/\s+/).filter(Boolean);
  const supported = new Set<keyof typeof MCP_SCOPES>(CHATGPT_APP_SCOPES);
  const invalid = requested.filter((item) => !supported.has(item as McpScope));
  if (invalid.length > 0) {
    throw new Error(`Unsupported OAuth scopes: ${invalid.join(", ")}`);
  }

  // Always grant the full supported scope set for this first-party MCP server.
  // Clients like mcp-remote may only request a minimal subset, but all scopes
  // are required for full MCP functionality.
  return CHATGPT_APP_SCOPES;
}

export function scopeString(scopes: string[]): string {
  return scopes.join(" ");
}

function isAllowedRedirectUri(redirectUri: string, allowedUris: string[]): boolean {
  return validateOAuthRedirectUri(redirectUri, allowedUris).ok;
}

export function validateOAuthClientMetadata(input: OAuthClientInput): {
  clientName: string | null;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
  scope: string;
} {
  const redirectUris = Array.isArray(input.redirect_uris)
    ? [...new Set(input.redirect_uris.filter((uri): uri is string => typeof uri === "string"))]
    : [];
  if (redirectUris.length === 0) {
    throw new Error("redirect_uris must contain at least one URI.");
  }
  if (redirectUris.length > 10) {
    throw new Error("redirect_uris cannot contain more than 10 entries.");
  }

  for (const uri of redirectUris) {
    const url = parseRedirectUri(uri);
    if (exactRedirectRequired() && url.protocol !== "https:") {
      throw new Error("Production redirect_uris must use https.");
    }
    if (!isAllowedRegistrationRedirectUrl(url) && !configuredRedirectUris().includes(uri)) {
      throw new Error(`redirect_uri is not allowed: ${uri}`);
    }
  }

  const grantTypes = Array.isArray(input.grant_types)
    ? input.grant_types.filter((grant): grant is string => typeof grant === "string")
    : ["authorization_code", "refresh_token"];
  const invalidGrantTypes = grantTypes.filter((grant) => !ALLOWED_GRANT_TYPES.has(grant));
  if (invalidGrantTypes.length > 0) {
    throw new Error(`Unsupported grant_types: ${invalidGrantTypes.join(", ")}`);
  }

  const responseTypes = Array.isArray(input.response_types)
    ? input.response_types.filter((type): type is string => typeof type === "string")
    : ["code"];
  const invalidResponseTypes = responseTypes.filter((type) => !ALLOWED_RESPONSE_TYPES.has(type));
  if (invalidResponseTypes.length > 0) {
    throw new Error(`Unsupported response_types: ${invalidResponseTypes.join(", ")}`);
  }

  const tokenEndpointAuthMethod =
    typeof input.token_endpoint_auth_method === "string"
      ? input.token_endpoint_auth_method
      : "none";
  if (tokenEndpointAuthMethod !== "none") {
    throw new Error("Only token_endpoint_auth_method=none is supported.");
  }

  const rawClientName =
    typeof input.client_name === "string" ? input.client_name.trim() : "";
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(rawClientName)) {
    throw new Error("client_name cannot contain control characters.");
  }

  return {
    clientName: rawClientName ? rawClientName.slice(0, 120) : null,
    redirectUris,
    grantTypes: [...new Set(grantTypes)],
    responseTypes: [...new Set(responseTypes)],
    tokenEndpointAuthMethod: "none",
    scope:
      typeof input.scope === "string"
        ? scopeString(parseOAuthScopes(input.scope))
        : scopeString(CHATGPT_APP_SCOPES),
  };
}

export async function getOAuthClient(clientId: string) {
  return prisma.mcpOAuthClient.findUnique({
    where: { clientId },
  });
}

export async function validateOAuthClient(params: {
  clientId: string;
  redirectUri: string;
}) {
  const configuredClientId = process.env.MCP_OAUTH_CLIENT_ID;
  let client = await getOAuthClient(params.clientId);

  if (!client && configuredClientId && params.clientId === configuredClientId) {
    client = await prisma.mcpOAuthClient.upsert({
      where: { clientId: params.clientId },
      create: {
        clientId: params.clientId,
        clientName: "Configured ChatGPT client",
        redirectUris: configuredRedirectUris(),
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        tokenEndpointAuthMethod: "none",
        scope: scopeString(CHATGPT_APP_SCOPES),
      },
      update: {},
    });
  }

  if (!client) {
    throw new Error("Unknown OAuth client. Register the client first or configure MCP_OAUTH_CLIENT_ID.");
  }

  if (client.tokenEndpointAuthMethod !== "none") {
    throw new Error("Only public OAuth clients with token_endpoint_auth_method=none are supported.");
  }

  const redirectValidation = validateOAuthRedirectUri(params.redirectUri, client.redirectUris);
  if (!redirectValidation.ok) {
    throw new Error(`redirect_uri is not allowed for this OAuth client: ${redirectValidation.reason}.`);
  }

  return client;
}

export function parseAuthorizeParams(url: URL, request?: Request): OAuthAuthorizeParams {
  const responseType = url.searchParams.get("response_type") || "";
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const state = url.searchParams.get("state") || undefined;
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "";

  if (responseType !== "code") throw new Error("response_type must be code.");
  if (!clientId) throw new Error("client_id is required.");
  if (!redirectUri) throw new Error("redirect_uri is required.");
  if (!codeChallenge) throw new Error("code_challenge is required.");
  if (codeChallengeMethod !== "S256") {
    throw new Error("Only code_challenge_method=S256 is supported.");
  }

  return {
    responseType,
    clientId,
    redirectUri,
    scope: parseOAuthScopes(url.searchParams.get("scope")),
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource: normalizeRequestedResource(url.searchParams.get("resource"), request),
  };
}

function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function registerOAuthClient(input: OAuthClientInput) {
  if (!MCP_CONFIG.OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION) {
    throw new Error("Dynamic OAuth client registration is disabled.");
  }

  const metadata = validateOAuthClientMetadata(input);

  const client = await prisma.mcpOAuthClient.create({
    data: {
      clientId: `a8n_oauth_client_${randomBytes(18).toString("base64url")}`,
      clientName: metadata.clientName,
      redirectUris: metadata.redirectUris,
      grantTypes: metadata.grantTypes,
      responseTypes: metadata.responseTypes,
      tokenEndpointAuthMethod: metadata.tokenEndpointAuthMethod,
      scope: metadata.scope,
    },
  });

  return {
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.clientName || undefined,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    scope: client.scope || scopeString(CHATGPT_APP_SCOPES),
  };
}

export async function issueAuthorizationCode(params: IssueAuthorizationCodeParams) {
  await validateOAuthClient({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
  });

  const code = randomToken(MCP_CONFIG.OAUTH_AUTH_CODE_PREFIX);
  await prisma.mcpOAuthAuthorizationCode.create({
    data: {
      codeHash: hashOAuthSecret(code),
      userId: params.userId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      resource: params.resource,
      scopes: params.scope,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt: new Date(Date.now() + MCP_CONFIG.OAUTH_AUTH_CODE_TTL_SECONDS * 1000),
    },
  });

  return code;
}

export async function recordOAuthConsent(params: {
  userId: string;
  clientId: string;
  scopes: string[];
  redirectUri: string;
  resource: string;
}) {
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "mcp_oauth_consent"
      SET "revokedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${params.userId}
        AND "clientId" = ${params.clientId}
        AND "revokedAt" IS NULL
    `,
    prisma.$executeRaw`
      INSERT INTO "mcp_oauth_consent"
        ("id", "userId", "clientId", "scopes", "redirectUri", "resource", "createdAt")
      VALUES
        (
          ${`mcp_oauth_consent_${randomBytes(18).toString("base64url")}`},
          ${params.userId},
          ${params.clientId},
          ARRAY[${Prisma.join(params.scopes)}]::TEXT[],
          ${params.redirectUri},
          ${params.resource},
          CURRENT_TIMESTAMP
        )
    `,
  ]);
}

async function issueTokenPair(params: {
  userId: string;
  clientId: string;
  resource: string;
  scopes: string[];
}) {
  const accessToken = randomToken(MCP_CONFIG.OAUTH_ACCESS_TOKEN_PREFIX);
  const refreshToken = randomToken(MCP_CONFIG.OAUTH_REFRESH_TOKEN_PREFIX);
  const accessTokenExpiresAt = new Date(
    Date.now() + MCP_CONFIG.OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
  );
  const refreshTokenExpiresAt = new Date(
    Date.now() + MCP_CONFIG.OAUTH_REFRESH_TOKEN_TTL_SECONDS * 1000,
  );

  await prisma.$transaction([
    prisma.mcpOAuthAccessToken.create({
      data: {
        tokenHash: hashOAuthSecret(accessToken),
        userId: params.userId,
        clientId: params.clientId,
        resource: params.resource,
        scopes: params.scopes,
        expiresAt: accessTokenExpiresAt,
      },
    }),
    prisma.mcpOAuthRefreshToken.create({
      data: {
        tokenHash: hashOAuthSecret(refreshToken),
        userId: params.userId,
        clientId: params.clientId,
        resource: params.resource,
        scopes: params.scopes,
        expiresAt: refreshTokenExpiresAt,
      },
    }),
  ]);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

export async function exchangeAuthorizationCode(params: ExchangeAuthorizationCodeParams) {
  const code = await prisma.mcpOAuthAuthorizationCode.findFirst({
    where: {
      codeHash: { in: oauthHashCandidates(params.code) },
    },
  });

  if (!code) throw new Error("Invalid authorization code.");
  if (code.consumedAt) throw new Error("Authorization code has already been used.");
  if (code.expiresAt < new Date()) throw new Error("Authorization code has expired.");
  if (code.clientId !== params.clientId) throw new Error("client_id does not match authorization code.");
  if (code.redirectUri !== params.redirectUri) throw new Error("redirect_uri does not match authorization code.");
  if (params.resource && code.resource !== params.resource.replace(/\/$/, "")) {
    throw new Error("resource does not match authorization code.");
  }
  if (!timingSafeStringEqual(pkceS256(params.codeVerifier), code.codeChallenge)) {
    if (process.env.NODE_ENV === "development") {
      console.error("[oauth] PKCE verification failed — challenge mismatch.");
    }
    throw new Error("PKCE verification failed.");
  }

  await validateOAuthClient({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
  });

  await prisma.mcpOAuthAuthorizationCode.update({
    where: { id: code.id },
    data: { consumedAt: new Date() },
  });

  const tokens = await issueTokenPair({
    userId: code.userId,
    clientId: code.clientId,
    resource: code.resource,
    scopes: code.scopes,
  });

  return {
    token_type: "Bearer",
    access_token: tokens.accessToken,
    expires_in: MCP_CONFIG.OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: tokens.refreshToken,
    refresh_token_expires_in: MCP_CONFIG.OAUTH_REFRESH_TOKEN_TTL_SECONDS,
    scope: scopeString(code.scopes),
    resource: code.resource,
  };
}

export async function refreshAccessToken(params: RefreshAccessTokenParams) {
  const refreshToken = await prisma.mcpOAuthRefreshToken.findFirst({
    where: {
      tokenHash: { in: oauthHashCandidates(params.refreshToken) },
    },
  });

  if (!refreshToken) throw new Error("Invalid refresh token.");
  if (refreshToken.revokedAt) throw new Error("Refresh token has been revoked.");
  if (refreshToken.expiresAt < new Date()) throw new Error("Refresh token has expired.");
  if (refreshToken.clientId !== params.clientId) throw new Error("client_id does not match refresh token.");
  if (params.resource && refreshToken.resource !== params.resource.replace(/\/$/, "")) {
    throw new Error("resource does not match refresh token.");
  }

  const accessToken = randomToken(MCP_CONFIG.OAUTH_ACCESS_TOKEN_PREFIX);
  const rotatedRefreshToken = MCP_CONFIG.OAUTH_ROTATE_REFRESH_TOKENS
    ? randomToken(MCP_CONFIG.OAUTH_REFRESH_TOKEN_PREFIX)
    : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.mcpOAuthRefreshToken.update({
      where: { id: refreshToken.id },
      data: {
        lastUsedAt: new Date(),
        ...(rotatedRefreshToken ? { revokedAt: new Date() } : {}),
      },
    });
    await tx.mcpOAuthAccessToken.create({
      data: {
        tokenHash: hashOAuthSecret(accessToken),
        userId: refreshToken.userId,
        clientId: refreshToken.clientId,
        resource: refreshToken.resource,
        scopes: refreshToken.scopes,
        expiresAt: new Date(Date.now() + MCP_CONFIG.OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000),
      },
    });
    if (rotatedRefreshToken) {
      await tx.mcpOAuthRefreshToken.create({
        data: {
          tokenHash: hashOAuthSecret(rotatedRefreshToken),
          userId: refreshToken.userId,
          clientId: refreshToken.clientId,
          resource: refreshToken.resource,
          scopes: refreshToken.scopes,
          expiresAt: new Date(Date.now() + MCP_CONFIG.OAUTH_REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      });
    }
  });

  return {
    token_type: "Bearer",
    access_token: accessToken,
    expires_in: MCP_CONFIG.OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    ...(rotatedRefreshToken
      ? {
          refresh_token: rotatedRefreshToken,
          refresh_token_expires_in: MCP_CONFIG.OAUTH_REFRESH_TOKEN_TTL_SECONDS,
        }
      : {}),
    scope: scopeString(refreshToken.scopes),
    resource: refreshToken.resource,
  };
}

export async function revokeOAuthToken(token: string) {
  const hashes = oauthHashCandidates(token);
  const [access, refresh] = await prisma.$transaction([
    prisma.mcpOAuthAccessToken.updateMany({
      where: { tokenHash: { in: hashes }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.mcpOAuthRefreshToken.updateMany({
      where: { tokenHash: { in: hashes }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return access.count + refresh.count;
}

export async function revokeOAuthClientUserTokens(params: {
  userId: string;
  clientId: string;
}) {
  const [access, refresh, consent] = await prisma.$transaction([
    prisma.mcpOAuthAccessToken.updateMany({
      where: { userId: params.userId, clientId: params.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.mcpOAuthRefreshToken.updateMany({
      where: { userId: params.userId, clientId: params.clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.$executeRaw`
      UPDATE "mcp_oauth_consent"
      SET "revokedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${params.userId}
        AND "clientId" = ${params.clientId}
        AND "revokedAt" IS NULL
    `,
  ]);

  return {
    accessTokensRevoked: access.count,
    refreshTokensRevoked: refresh.count,
    consentsRevoked: Number(consent),
  };
}

export async function cleanupExpiredOAuthArtifacts(now = new Date()) {
  const [authorizationCodes, accessTokens, refreshTokens] = await prisma.$transaction([
    prisma.mcpOAuthAuthorizationCode.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.mcpOAuthAccessToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.mcpOAuthRefreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ]);

  return {
    authorizationCodesDeleted: authorizationCodes.count,
    accessTokensDeleted: accessTokens.count,
    refreshTokensDeleted: refreshTokens.count,
  };
}

export async function validateOAuthAccessToken(
  token: string,
  request: Request,
): Promise<AuthResult> {
  if (!token.startsWith(MCP_CONFIG.OAUTH_ACCESS_TOKEN_PREFIX)) {
    return { ok: false, error: "Not an OAuth access token", status: 401 };
  }

  const accessToken = await prisma.mcpOAuthAccessToken.findFirst({
    where: {
      tokenHash: { in: oauthHashCandidates(token) },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!accessToken) {
    return { ok: false, error: "Invalid OAuth access token", status: 401 };
  }
  if (accessToken.revokedAt) {
    return { ok: false, error: "OAuth access token revoked", status: 401 };
  }
  if (accessToken.expiresAt < new Date()) {
    return { ok: false, error: "OAuth access token expired", status: 401 };
  }
  if (!isAllowedOAuthResource(accessToken.resource, request)) {
    return { ok: false, error: "OAuth token resource does not match this MCP server", status: 401 };
  }

  void prisma.mcpOAuthAccessToken
    .update({
      where: { id: accessToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  const authInfo: McpAuthInfo = {
    userId: accessToken.user.id,
    userName: accessToken.user.name,
    userEmail: accessToken.user.email,
    scopes: accessToken.scopes as McpScope[],
    method: "oauth",
    oauthTokenId: accessToken.id,
    oauthClientId: accessToken.clientId,
    oauthResource: accessToken.resource,
  };

  return { ok: true, auth: authInfo };
}

export function oauthMetadata(request: Request) {
  const issuer = getOAuthIssuer(request);
  const scopesSupported = supportedOAuthScopes();
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    jwks_uri: `${issuer}/api/oauth/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: scopesSupported,
    resource_parameter_supported: true,
  };
}

export function protectedResourceMetadata(request: Request) {
  const issuer = getOAuthIssuer(request);
  return {
    resource: getOAuthResource(request),
    authorization_servers: [issuer],
    scopes_supported: supportedOAuthScopes(),
    bearer_methods_supported: ["header"],
    resource_documentation: `${issuer}/docs/mcp`,
  };
}

export function buildOAuthWwwAuthenticateHeader(
  request: Request,
  scope = "workflows:read system:read",
): string {
  const issuer = getOAuthIssuer(request);
  return [
    "Bearer",
    `realm="${MCP_CONFIG.SERVER_NAME}"`,
    `resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
    `scope="${scope}"`,
  ].join(" ");
}
