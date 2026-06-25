/**
 * MCP Authentication Types
 *
 * Defines the auth context that flows through every MCP tool call
 * after successful authentication.
 */

import type { McpScope } from "./scopes";

/** The authenticated context attached to every MCP request */
export interface McpAuthInfo {
  /** The authenticated user's ID */
  userId: string;

  /** The user's display name */
  userName: string;

  /** The user's email */
  userEmail: string;

  /** Granted permission scopes for this session/key */
  scopes: McpScope[];

  /** The API key ID (if authenticated via API key) */
  apiKeyId?: string;

  /** Authentication method used */
  method: "api_key" | "session" | "oauth";

  /** OAuth access token row ID, when authenticated via ChatGPT account linking */
  oauthTokenId?: string;

  /** OAuth client ID, when authenticated via ChatGPT account linking */
  oauthClientId?: string;

  /** OAuth resource/audience, when authenticated via ChatGPT account linking */
  oauthResource?: string;
}

/** Result of bearer token validation */
export type AuthResult =
  | { ok: true; auth: McpAuthInfo }
  | { ok: false; error: string; status: number };
