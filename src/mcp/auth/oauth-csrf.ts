import { randomBytes, timingSafeEqual } from "crypto";

const CSRF_TTL_MS = 10 * 60 * 1000;
const csrfStore = new Map<string, number>();

export const OAUTH_CSRF_COOKIE = "a8n_mcp_oauth_csrf";

function cleanupExpired(now = Date.now()) {
  for (const [token, expiresAt] of csrfStore.entries()) {
    if (expiresAt <= now) csrfStore.delete(token);
  }
}

function sameToken(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function readCookie(headers: Headers, name: string): string | null {
  const cookie = headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function createOAuthCsrfToken(): string {
  cleanupExpired();
  const token = randomBytes(32).toString("base64url");
  csrfStore.set(token, Date.now() + CSRF_TTL_MS);
  return token;
}

export function oauthCsrfCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OAUTH_CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/api/oauth/authorize; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(CSRF_TTL_MS / 1000)}${secure}`;
}

export function clearOAuthCsrfCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OAUTH_CSRF_COOKIE}=; Path=/api/oauth/authorize; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function validateAndConsumeOAuthCsrf(
  request: Request,
  submittedToken: FormDataEntryValue | null,
): boolean {
  if (typeof submittedToken !== "string" || submittedToken.length === 0) return false;

  cleanupExpired();
  const cookieToken = readCookie(request.headers, OAUTH_CSRF_COOKIE);
  if (!cookieToken || !sameToken(cookieToken, submittedToken)) return false;

  const expiresAt = csrfStore.get(cookieToken);
  if (!expiresAt || expiresAt <= Date.now()) {
    csrfStore.delete(cookieToken);
    return false;
  }

  csrfStore.delete(cookieToken);
  return true;
}
