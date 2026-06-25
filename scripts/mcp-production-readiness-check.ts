import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

type Severity = "required" | "recommended";

type Check = {
  name: string;
  ok: boolean;
  severity: Severity;
  detail?: unknown;
};

type ParsedUrl = {
  raw: string;
  url: URL | null;
};

const CHATGPT_ORIGINS = ["https://chatgpt.com", "https://chat.openai.com"];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    allowDevHosts: args.has("--allow-dev-hosts"),
  };
}

function check(name: string, ok: boolean, severity: Severity = "required", detail?: unknown): Check {
  return { name, ok, severity, detail };
}

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUrl(value: string): ParsedUrl {
  try {
    return { raw: value, url: new URL(value) };
  } catch {
    return { raw: value, url: null };
  }
}

function isDevHost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.includes("ngrok") ||
    hostname.includes("loca.lt")
  );
}

function isPublicHttpsUrl(value: string, allowDevHosts: boolean): boolean {
  const parsed = parseUrl(value);
  if (!parsed.url) return false;
  if (parsed.url.protocol === "https:" && (allowDevHosts || !isDevHost(parsed.url))) {
    return true;
  }
  return allowDevHosts && parsed.url.protocol === "http:" && isDevHost(parsed.url);
}

function originOf(value: string): string | null {
  const parsed = parseUrl(value);
  return parsed.url?.origin || null;
}

function secretOk(name: string): boolean {
  return env(name).length >= 32;
}

function localRouteExists(route: "privacy" | "support"): boolean {
  return fs.existsSync(path.join(process.cwd(), "src", "app", route, "page.tsx"));
}

function validateAppUrls(allowDevHosts: boolean): Check[] {
  const appUrl = env("APP_URL");
  const publicAppUrl = env("NEXT_PUBLIC_APP_URL");
  const webhookBaseUrl = env("NEXT_PUBLIC_WEBHOOK_BASE_URL");
  const appOrigin = originOf(appUrl);
  const publicOrigin = originOf(publicAppUrl);
  const webhookOrigin = originOf(webhookBaseUrl);

  return [
    check("APP_URL is configured for a public app origin", isPublicHttpsUrl(appUrl, allowDevHosts), "required", {
      configured: Boolean(appUrl),
    }),
    check(
      "NEXT_PUBLIC_APP_URL is configured for widget domain",
      isPublicHttpsUrl(publicAppUrl, allowDevHosts),
      "required",
      { configured: Boolean(publicAppUrl) },
    ),
    check(
      "NEXT_PUBLIC_WEBHOOK_BASE_URL is configured for callbacks",
      isPublicHttpsUrl(webhookBaseUrl, allowDevHosts),
      "required",
      { configured: Boolean(webhookBaseUrl) },
    ),
    check(
      "APP_URL and NEXT_PUBLIC_APP_URL share the same origin",
      Boolean(appOrigin && publicOrigin && appOrigin === publicOrigin),
      "required",
      { appOrigin, publicOrigin },
    ),
    check(
      "webhook base URL shares the production origin",
      Boolean(appOrigin && webhookOrigin && appOrigin === webhookOrigin),
      "recommended",
      { appOrigin, webhookOrigin },
    ),
  ];
}

function validateCors(allowDevHosts: boolean): Check[] {
  const corsOrigins = csv(env("MCP_CORS_ORIGINS"));
  const parsedOrigins = corsOrigins.map(parseUrl);
  const originsAreValid = parsedOrigins.every(
    (item) =>
      item.url &&
      item.url.origin === item.raw.replace(/\/$/, "") &&
      isPublicHttpsUrl(item.raw, allowDevHosts),
  );

  return [
    check("MCP_CORS_ORIGINS is explicit", corsOrigins.length > 0 && !corsOrigins.includes("*"), "required", {
      count: corsOrigins.length,
    }),
    check(
      "MCP_CORS_ORIGINS includes ChatGPT origins",
      CHATGPT_ORIGINS.every((origin) => corsOrigins.includes(origin)),
      "required",
      { required: CHATGPT_ORIGINS, configured: corsOrigins },
    ),
    check("MCP_CORS_ORIGINS values are origins, not paths", originsAreValid, "required", {
      configured: corsOrigins,
    }),
  ];
}

function validateOAuth(allowDevHosts: boolean): Check[] {
  const issuer = env("MCP_OAUTH_ISSUER");
  const resource = env("MCP_OAUTH_RESOURCE");
  const appOrigin = originOf(env("APP_URL"));
  const issuerOrigin = originOf(issuer);
  const resourceOrigin = originOf(resource);
  const redirectUris = csv(env("MCP_OAUTH_REDIRECT_URIS"));
  const redirectUrls = redirectUris.map(parseUrl);
  const hasChatGptRedirect = redirectUrls.some(
    (item) =>
      item.url?.protocol === "https:" &&
      item.url.hostname === "chatgpt.com" &&
      item.url.pathname.startsWith("/connector/oauth/"),
  );
  const redirectUrisValid = redirectUrls.every(
    (item) => item.url && item.url.protocol === "https:" && !isDevHost(item.url),
  );

  return [
    check("MCP_OAUTH_ISSUER is configured", isPublicHttpsUrl(issuer, allowDevHosts), "required", {
      configured: Boolean(issuer),
    }),
    check("MCP_OAUTH_RESOURCE is configured", isPublicHttpsUrl(resource, allowDevHosts), "required", {
      configured: Boolean(resource),
    }),
    check(
      "OAuth issuer/resource match APP_URL origin",
      Boolean(appOrigin && issuerOrigin === appOrigin && resourceOrigin === appOrigin),
      "required",
      { appOrigin, issuerOrigin, resourceOrigin },
    ),
    check("OAuth redirect URIs are configured", redirectUris.length > 0, "required", {
      count: redirectUris.length,
    }),
    check("OAuth redirect URIs are HTTPS production URLs", redirectUrisValid, "required", {
      redirectUriCount: redirectUris.length,
    }),
    check(
      "OAuth redirect URIs include ChatGPT connector callback",
      hasChatGptRedirect,
      "required",
      { expectedShape: "https://chatgpt.com/connector/oauth/{callback_id}" },
    ),
    check(
      "Dynamic client registration is enabled unless a fixed ChatGPT client is configured",
      env("MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION") !== "false" ||
        Boolean(env("MCP_OAUTH_CLIENT_ID")),
      "required",
      {
        allowDynamicClientRegistration:
          env("MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION") || "default:true",
        hasConfiguredClient: Boolean(env("MCP_OAUTH_CLIENT_ID")),
      },
    ),
  ];
}

function validateSecretsAndAudit(): Check[] {
  return [
    check("MCP_API_KEY_HMAC_SECRET is at least 32 characters", secretOk("MCP_API_KEY_HMAC_SECRET"), "required"),
    check(
      "OAuth token hashing secret is configured",
      secretOk("MCP_OAUTH_TOKEN_HMAC_SECRET") || secretOk("MCP_API_KEY_HMAC_SECRET"),
      "required",
      { dedicatedOAuthSecret: secretOk("MCP_OAUTH_TOKEN_HMAC_SECRET") },
    ),
    check("MCP_AUDIT_LOG_ENABLED=true", env("MCP_AUDIT_LOG_ENABLED") === "true", "required"),
    check("MCP_AUDIT_DB_ENABLED=true", env("MCP_AUDIT_DB_ENABLED") === "true", "required"),
  ];
}

function validatePublicPages(): Check[] {
  return [
    check("privacy page exists", localRouteExists("privacy"), "required", {
      route: "/privacy",
    }),
    check("support page exists", localRouteExists("support"), "required", {
      route: "/support",
    }),
  ];
}

function main() {
  const options = parseArgs();
  const checks = [
    ...validateAppUrls(options.allowDevHosts),
    ...validateCors(options.allowDevHosts),
    ...validateOAuth(options.allowDevHosts),
    ...validateSecretsAndAudit(),
    ...validatePublicPages(),
  ];
  const requiredFailures = checks.filter(
    (item) => item.severity === "required" && !item.ok,
  );
  const recommendedFailures = checks.filter(
    (item) => item.severity === "recommended" && !item.ok,
  );
  const passed = requiredFailures.length === 0;
  const report = {
    suite: "chatgpt-app-phase-7-production-readiness",
    generatedAt: new Date().toISOString(),
    allowDevHosts: options.allowDevHosts,
    passed,
    requiredFailures,
    recommendedFailures,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT Apps Phase 7 production readiness check");
    console.log(`Development hosts allowed: ${options.allowDevHosts ? "yes" : "no"}`);
    console.log("");
    for (const item of checks) {
      const label = item.severity === "required" ? "required" : "recommended";
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"} (${label})`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
