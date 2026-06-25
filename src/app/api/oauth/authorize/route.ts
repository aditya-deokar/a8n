import { auth } from "@/lib/auth";
import {
  issueAuthorizationCode,
  parseAuthorizeParams,
  scopeString,
  validateOAuthClient,
  type OAuthAuthorizeParams,
} from "@/mcp/auth/oauth.service";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function oauthErrorRedirect(
  redirectUri: string,
  error: string,
  description: string,
  state?: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}

function badRequest(message: string): Response {
  return new Response(
    `<!doctype html><html><body><h1>OAuth request error</h1><p>${escapeHtml(message)}</p></body></html>`,
    {
      status: 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function redirectToLogin(request: Request): Response {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("callbackURL", `${requestUrl.pathname}${requestUrl.search}`);
  return Response.redirect(loginUrl, 302);
}

async function currentSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

function consentHtml(params: OAuthAuthorizeParams, user: { email: string; name?: string | null }) {
  const scopes = params.scope.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`).join("");
  const hiddenFields = [
    ["response_type", params.responseType],
    ["client_id", params.clientId],
    ["redirect_uri", params.redirectUri],
    ["scope", scopeString(params.scope)],
    ["state", params.state || ""],
    ["code_challenge", params.codeChallenge],
    ["code_challenge_method", params.codeChallengeMethod],
    ["resource", params.resource],
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect a8n to ChatGPT</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8fb; color: #15151a; padding: 24px; }
    main { width: min(520px, 100%); border: 1px solid #e4e7ee; border-radius: 12px; background: #fff; padding: 24px; box-shadow: 0 12px 40px rgb(15 23 42 / 10%); }
    h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.2; letter-spacing: 0; }
    p { line-height: 1.5; color: #525866; }
    ul { padding-left: 22px; }
    li { margin: 6px 0; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; }
    .actions { display: flex; gap: 10px; margin-top: 20px; }
    button { min-height: 40px; border-radius: 8px; border: 1px solid #111827; padding: 8px 14px; font: inherit; cursor: pointer; }
    .primary { background: #111827; color: #fff; }
    .secondary { background: transparent; color: inherit; }
    .meta { border: 1px solid #e4e7ee; border-radius: 8px; padding: 10px; background: #fafbfc; overflow-wrap: anywhere; }
    @media (max-width: 520px) { .actions { display: grid; } button { width: 100%; } }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0d12; color: #f3f4f6; }
      main { background: #111827; border-color: #263244; }
      p { color: #a7b0bd; }
      .meta { background: #0f172a; border-color: #263244; }
      .primary { background: #f3f4f6; color: #111827; border-color: #f3f4f6; }
      .secondary { border-color: #4b5563; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Connect a8n to ChatGPT</h1>
    <p>Signed in as <strong>${escapeHtml(user.name || user.email)}</strong>. ChatGPT is requesting access to your a8n account.</p>
    <div class="meta">
      <p><strong>Client:</strong> <code>${escapeHtml(params.clientId)}</code></p>
      <p><strong>Resource:</strong> <code>${escapeHtml(params.resource)}</code></p>
    </div>
    <p>Requested scopes:</p>
    <ul>${scopes}</ul>
    <form method="post" action="/api/oauth/authorize">
      ${hiddenFields}
      <div class="actions">
        <button class="primary" type="submit" name="action" value="approve">Allow</button>
        <button class="secondary" type="submit" name="action" value="deny">Deny</button>
      </div>
    </form>
  </main>
</body>
</html>`;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = parseAuthorizeParams(url, request);
    await validateOAuthClient({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
    });

    const session = await currentSession(request);
    if (!session) return redirectToLogin(request);

    return new Response(consentHtml(params, session.user), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid OAuth authorization request.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await currentSession(request);
  if (!session) return redirectToLogin(request);

  const form = await request.formData();
  const action = String(form.get("action") || "");
  const url = new URL(request.url);
  for (const key of [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
    "resource",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") url.searchParams.set(key, value);
  }

  try {
    const params = parseAuthorizeParams(url, request);
    await validateOAuthClient({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
    });

    if (action !== "approve") {
      return oauthErrorRedirect(
        params.redirectUri,
        "access_denied",
        "The user denied access to a8n.",
        params.state,
      );
    }

    const code = await issueAuthorizationCode({
      ...params,
      userId: session.user.id,
    });
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) redirectUrl.searchParams.set("state", params.state);

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid OAuth authorization request.");
  }
}
