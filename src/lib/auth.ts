import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import prisma from "@/lib/db";
import { polarClient } from "./polar";

const useMockedExternalServices =
  process.env.E2E_TESTS === "true" && process.env.E2E_EXTERNAL_SERVICES === "mock";

const appUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const trustedOrigins = Array.from(
  new Set(
    [appUrl, process.env.NEXT_PUBLIC_APP_URL, process.env.NGROK_URL]
      .filter((origin): origin is string => Boolean(origin))
      .map((origin) => origin.replace(/\/$/, "")),
  ),
);

const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
                  successUrl: process.env.POLAR_SUCCESS_URL,
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
