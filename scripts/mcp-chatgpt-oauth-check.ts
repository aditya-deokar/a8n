/**
 * Phase 4 readiness check for ChatGPT OAuth account linking.
 *
 * Verifies:
 *   1. Protected resource metadata exists.
 *   2. OAuth authorization server metadata exists.
 *   3. JWKS endpoint exists, even though a8n currently uses opaque tokens.
 *   4. Unauthenticated MCP requests return a WWW-Authenticate OAuth challenge.
 */

import "dotenv/config";

function endpointFromEnv() {
  const explicit =
    process.env.MCP_CHATGPT_DEV_URL ||
    process.env.MCP_ENDPOINT_URL ||
    process.env.MCP_SERVER_URL;

  if (explicit) return explicit;

  const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
  if (ngrokUrl) return `${ngrokUrl}/api/mcp?profile=chatgpt`;

  return "http://localhost:3000/api/mcp?profile=chatgpt";
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
  };
}

async function readJson(url: string) {
  const response = await fetch(url);
  const json = await response.json().catch(() => null);
  return {
    url,
    status: response.status,
    ok: response.ok,
    json,
  };
}

async function main() {
  const options = parseArgs();
  const mcpEndpoint = endpointFromEnv();
  const origin = new URL(mcpEndpoint).origin;
  const urls = {
    protectedResource: `${origin}/.well-known/oauth-protected-resource`,
    authorizationServer: `${origin}/.well-known/oauth-authorization-server`,
    openidConfiguration: `${origin}/.well-known/openid-configuration`,
    jwks: `${origin}/api/oauth/jwks.json`,
  };

  const [protectedResource, authorizationServer, openidConfiguration, jwks] =
    await Promise.all([
      readJson(urls.protectedResource),
      readJson(urls.authorizationServer),
      readJson(urls.openidConfiguration),
      readJson(urls.jwks),
    ]);

  const challengeResponse = await fetch(mcpEndpoint, { method: "GET" });
  const wwwAuthenticate = challengeResponse.headers.get("www-authenticate") || "";

  const report = {
    phase: "chatgpt-app-phase-4",
    endpoint: mcpEndpoint,
    generatedAt: new Date().toISOString(),
    protectedResource: {
      ok:
        protectedResource.ok &&
        typeof protectedResource.json?.resource === "string" &&
        Array.isArray(protectedResource.json?.authorization_servers),
      status: protectedResource.status,
      resource: protectedResource.json?.resource,
    },
    authorizationServer: {
      ok:
        authorizationServer.ok &&
        typeof authorizationServer.json?.authorization_endpoint === "string" &&
        typeof authorizationServer.json?.token_endpoint === "string" &&
        Array.isArray(authorizationServer.json?.code_challenge_methods_supported),
      status: authorizationServer.status,
      issuer: authorizationServer.json?.issuer,
    },
    openidConfiguration: {
      ok:
        openidConfiguration.ok &&
        typeof openidConfiguration.json?.authorization_endpoint === "string" &&
        typeof openidConfiguration.json?.token_endpoint === "string",
      status: openidConfiguration.status,
    },
    jwks: {
      ok: jwks.ok && Array.isArray(jwks.json?.keys),
      status: jwks.status,
      keyCount: Array.isArray(jwks.json?.keys) ? jwks.json.keys.length : null,
    },
    mcpChallenge: {
      ok:
        challengeResponse.status === 401 &&
        wwwAuthenticate.includes("resource_metadata=") &&
        wwwAuthenticate.includes("/.well-known/oauth-protected-resource"),
      status: challengeResponse.status,
      wwwAuthenticate,
    },
  };

  const passed =
    report.protectedResource.ok &&
    report.authorizationServer.ok &&
    report.openidConfiguration.ok &&
    report.jwks.ok &&
    report.mcpChallenge.ok;

  if (options.json) {
    console.log(JSON.stringify({ ...report, passed }, null, 2));
  } else {
    console.log("a8n ChatGPT Apps Phase 4 OAuth readiness check");
    console.log(`Endpoint: ${mcpEndpoint}`);
    console.log(`Protected resource metadata: ${report.protectedResource.ok ? "ok" : "failed"}`);
    console.log(`Authorization server metadata: ${report.authorizationServer.ok ? "ok" : "failed"}`);
    console.log(`OpenID configuration: ${report.openidConfiguration.ok ? "ok" : "failed"}`);
    console.log(`JWKS endpoint: ${report.jwks.ok ? "ok" : "failed"}`);
    console.log(`MCP OAuth challenge: ${report.mcpChallenge.ok ? "ok" : "failed"}`);
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error("ChatGPT OAuth readiness check failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
