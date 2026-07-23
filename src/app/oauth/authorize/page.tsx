import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parseAuthorizeParams, validateOAuthClient } from "@/mcp/auth/oauth.service";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cookies, headers } from "next/headers";
import { OAUTH_CSRF_COOKIE } from "@/mcp/auth/oauth-csrf";

export const dynamic = "force-dynamic";

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const paramsObj = await searchParams;
  
  // Await headers for Next.js 15+ and convert to standard Headers to avoid Symbol errors in Better Auth
  const nextHeaders = await headers();
  const standardHeaders = new Headers();
  nextHeaders.forEach((value, key) => {
    standardHeaders.append(key, value);
  });

  const session = await auth.api.getSession({
    headers: standardHeaders,
  });
  
  if (!session) {
    const loginUrl = new URL("/login", "http://localhost");
    const searchString = new URLSearchParams(paramsObj as Record<string, string>).toString();
    loginUrl.searchParams.set("callbackURL", `/api/oauth/authorize?${searchString}`);
    redirect(loginUrl.pathname + loginUrl.search);
  }

  // Construct URL to use the existing parseAuthorizeParams function
  const host = nextHeaders.get("host") || "localhost:3000";
  const protocol = nextHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  
  const url = new URL(`${baseUrl}/oauth/authorize`);
  for (const [key, value] of Object.entries(paramsObj)) {
    if (typeof value === "string") url.searchParams.set(key, value);
  }

  let params;
  let client;
  try {
    params = parseAuthorizeParams(url, new Request(url));
    client = await validateOAuthClient({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
    });
  } catch (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Authorization Error</CardTitle>
            <CardDescription>{error instanceof Error ? error.message : "Invalid OAuth authorization request."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const cookieStore = await cookies();
  const csrfToken = cookieStore.get(OAUTH_CSRF_COOKIE)?.value || "";
  const displayName = client.clientName || params.clientId;

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#f6f8fb] dark:bg-[#18181b]">
      <Card className="w-full max-w-lg bg-white dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.05)] dark:shadow-none rounded-3xl overflow-hidden">
        <CardHeader className="space-y-4 px-8 pt-8">
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Connect a8n to {displayName}
          </CardTitle>
          <CardDescription className="text-[15px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
            Signed in as <span className="font-semibold text-gray-900 dark:text-gray-100">{session.user.name || session.user.email}</span>.{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{displayName}</span> is requesting access to your a8n account.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-8 px-8">
          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-[#f8f9fc] dark:bg-white/5 p-5 space-y-4 shadow-inner">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Client</div>
              <code className="text-[13px] font-medium text-[#5c54a4] dark:text-indigo-300 bg-[#5c54a4]/10 dark:bg-indigo-500/10 px-2 py-1 rounded-md border border-[#5c54a4]/20 dark:border-indigo-500/20">{params.clientId}</code>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Redirect URI</div>
              <code className="text-[13px] font-medium text-[#5c54a4] dark:text-indigo-300 bg-[#5c54a4]/10 dark:bg-indigo-500/10 px-2 py-1 rounded-md border border-[#5c54a4]/20 dark:border-indigo-500/20 break-all">{params.redirectUri}</code>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Resource</div>
              <code className="text-[13px] font-medium text-[#5c54a4] dark:text-indigo-300 bg-[#5c54a4]/10 dark:bg-indigo-500/10 px-2 py-1 rounded-md border border-[#5c54a4]/20 dark:border-indigo-500/20 break-all">{params.resource}</code>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Requested scopes</h3>
            <ul className="space-y-3">
              {params.scope.map((scope) => (
                <li key={scope} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[#5c54a4] dark:bg-indigo-400 shadow-[0_0_8px_rgba(92,84,164,0.4)] dark:shadow-[0_0_8px_rgba(129,140,248,0.4)]" />
                  <Badge variant="secondary" className="font-mono text-[13px] font-medium bg-[#f8f9fc] dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 border">
                    {scope}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        
        <CardFooter className="px-8 pb-8 pt-4">
          <form method="post" action="/api/oauth/authorize" className="w-full">
            <input type="hidden" name="response_type" value={params.responseType} />
            <input type="hidden" name="client_id" value={params.clientId} />
            <input type="hidden" name="redirect_uri" value={params.redirectUri} />
            <input type="hidden" name="scope" value={params.scope.join(" ")} />
            <input type="hidden" name="state" value={params.state || ""} />
            <input type="hidden" name="code_challenge" value={params.codeChallenge} />
            <input type="hidden" name="code_challenge_method" value={params.codeChallengeMethod} />
            <input type="hidden" name="resource" value={params.resource} />
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
              <Button type="submit" name="action" value="approve" className="flex-1 bg-gradient-to-b from-[#5c54a4] to-[#9187ce] hover:opacity-90 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset] border-0 text-[15px] font-medium h-12 rounded-xl transition-all duration-300" size="lg">
                Allow Access
              </Button>
              <Button type="submit" name="action" value="deny" variant="outline" className="flex-1 border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-[15px] font-medium h-12 rounded-xl transition-all duration-300 shadow-sm" size="lg">
                Deny
              </Button>
            </div>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
