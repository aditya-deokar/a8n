import net from "node:net";

export type EgressUrlCheck = {
  allowed: boolean;
  reason: string;
  normalizedUrl?: string;
};

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 0
  );
}

function isBlockedIp(hostname: string): boolean {
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) return isPrivateIpv4(hostname);
  if (ipVersion === 6) {
    const normalized = hostname.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

export function checkEgressUrlSafety(rawUrl: string): EgressUrlCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "invalid-url" };
  }

  if (url.protocol !== "https:") {
    return {
      allowed: false,
      reason: "unsupported-or-insecure-scheme",
      normalizedUrl: url.toString(),
    };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal")
  ) {
    return {
      allowed: false,
      reason: "blocked-local-hostname",
      normalizedUrl: url.toString(),
    };
  }

  if (isBlockedIp(hostname)) {
    return {
      allowed: false,
      reason: "blocked-private-or-metadata-ip",
      normalizedUrl: url.toString(),
    };
  }

  return {
    allowed: true,
    reason: "allowed-public-https-url",
    normalizedUrl: url.toString(),
  };
}
