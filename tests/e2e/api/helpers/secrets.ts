const SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/[^\s"']+/i,
  /\bDATABASE_URL\b/i,
  /\bENCRYPTION_KEY\b/i,
  /\bBETTER_AUTH_SECRET\b/i,
  /\bPOLAR_ACCESS_TOKEN\b/i,
  /\bMCP_API_KEY_HMAC_SECRET\b/i,
  /\bMCP_OAUTH_TOKEN_HMAC_SECRET\b/i,
  /\b(?:test-)?(?:google-form|stripe|a8n-shared)-webhook-secret\b/i,
  /\bwhsec_[A-Za-z0-9_]+\b/i,
  /\bkeyHash\b/i,
  /\btokenHash\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\ba8n_mcp_[A-Za-z0-9._-]+/i,
  /\bsk-(?:live|test|proj)-[A-Za-z0-9_-]+/i,
];

export function findSecretLeak(value: string) {
  return SECRET_PATTERNS.find((pattern) => pattern.test(value));
}

export function hasSecretLeak(value: string) {
  return Boolean(findSecretLeak(value));
}
