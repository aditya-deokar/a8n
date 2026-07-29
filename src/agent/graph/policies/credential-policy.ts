import type { CredentialRef } from "../state";

/**
 * Credential policy for the embedded agent.
 *
 * The agent may refer to credentials by safe metadata (ID, name, type, status)
 * but never by secret values. If a secret-backed integration is needed,
 * the agent emits a credential-selector reference so the UI can show a picker.
 */

/**
 * Sanitize a raw credential record from the database into a safe reference.
 * Strips everything except metadata the agent is allowed to see.
 */
export function sanitizeCredentialRef(credential: {
  id: string;
  name: string;
  type: string;
}): CredentialRef {
  return {
    id: credential.id,
    name: credential.name,
    type: credential.type,
    connected: true,
  };
}

/**
 * Create a placeholder credential reference for a required but unconfigured
 * credential. The UI should show a credential picker for this type.
 */
export function missingCredentialRef(
  type: string,
  displayName?: string,
): CredentialRef {
  return {
    id: "",
    name: displayName || `${type} credential`,
    type,
    connected: false,
  };
}

/**
 * Extract credential requirement hints from a draft's missing fields.
 * Returns refs for credentials that need to be selected or created.
 */
export function extractCredentialRefs(
  missingFields: Array<{ field: string; nodeType?: string; description?: string }>,
  existingCredentials: Array<{ id: string; name: string; type: string }> = [],
): CredentialRef[] {
  const credentialFields = missingFields.filter(
    (f) =>
      f.field.toLowerCase().includes("credential") ||
      f.field.toLowerCase().includes("credentialid"),
  );

  if (credentialFields.length === 0) return [];

  const refs: CredentialRef[] = [];
  for (const field of credentialFields) {
    const nodeType = field.nodeType || "unknown";
    const existing = existingCredentials.find(
      (c) => c.type.toLowerCase() === nodeType.toLowerCase(),
    );

    if (existing) {
      refs.push(sanitizeCredentialRef(existing));
    } else {
      refs.push(missingCredentialRef(nodeType, field.description));
    }
  }

  return refs;
}
