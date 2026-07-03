import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";

const authBaseURL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  basePath: "/api/auth",
  plugins: [polarClient()],
});
