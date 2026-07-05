import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import prisma from "@/lib/db";
import { polarClient } from "./polar";

const useMockedExternalServices =
  env.E2E_TESTS === true && env.E2E_EXTERNAL_SERVICES === "mock";

const appUrl =
  env.BETTER_AUTH_URL ||
  env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

function trimTrailingSlash(origin: string) {
  return origin.replace(/\/$/, "");
}

function expandLoopbackOrigins(origin: string) {
  const normalizedOrigin = trimTrailingSlash(origin);

  try {
    const parsed = new URL(normalizedOrigin);
    const isLoopback =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1";

    if (!isLoopback) return [normalizedOrigin];

    const port = parsed.port ? `:${parsed.port}` : "";
    return [
      normalizedOrigin,
      `${parsed.protocol}//localhost${port}`,
      `${parsed.protocol}//127.0.0.1${port}`,
    ];
  } catch {
    return [normalizedOrigin];
  }
}

const trustedOrigins = Array.from(
  new Set(
    [appUrl, env.NEXT_PUBLIC_APP_URL, env.APP_URL, env.NGROK_URL]
      .filter((origin): origin is string => Boolean(origin))
      .flatMap(expandLoopbackOrigins),
  ),
);

const socialProviders = {
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

export const auth = betterAuth({
  baseURL: appUrl,
  basePath: "/api/auth",
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders,
  plugins: [
    ...(
      useMockedExternalServices
        ? []
        : [
            polar({
              client: polarClient,
              createCustomerOnSignUp: true,
              use: [
                checkout({
                  products: [
                    {
                      productId: "58285280-605b-468f-b711-5b5c9ff936bd",
                      slug: "pro",
                    }
                  ],
                  successUrl: env.POLAR_SUCCESS_URL,
                  authenticatedUsersOnly: true,
                }),
                portal(),
              ],
            }),
          ]
    ),
    nextCookies(),
  ],
});
