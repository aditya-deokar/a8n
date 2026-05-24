# ADR-007: AES-256 Credential Encryption at Rest

**Status:** Accepted  
**Date:** April 2026  
**Deciders:** Project team

---

## Context

a8n stores third-party API keys (OpenAI, Anthropic, Gemini) in the database. These credentials are used during workflow execution to call external AI services.

**Security requirements:**
- API keys must never be stored in plaintext in the database
- Keys should be decrypted only at the moment of use (execution time)
- If the database is compromised, credentials should not be directly usable
- The encryption/decryption process should be simple and reliable

## Decision

**We encrypt all credential values with AES-256 via the Cryptr library before storing them in the database.**

### Implementation

```typescript
// src/lib/encryption.ts
import Cryptr from "cryptr";

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY!);

export const encrypt = (text: string) => cryptr.encrypt(text);
export const decrypt = (text: string) => cryptr.decrypt(text);
```

### Encryption Flow

```
User creates credential:
  User Input (raw API key) → encrypt() → database (ciphertext)

Workflow execution:
  database (ciphertext) → decrypt() → AI SDK → API Call
  
tRPC read queries:
  database (ciphertext) → return as-is (still encrypted)
```

### Key Points

1. **Encrypt on write** — `credentials.create` and `credentials.update` tRPC mutations call `encrypt(value)` before Prisma insert
2. **Decrypt on execute** — Executor functions call `decrypt(credential.value)` at execution time
3. **Never expose** — tRPC queries return the encrypted value — clients never see the raw API key
4. **User-scoped** — Executors verify `userId` when fetching credentials: `where: { id: credentialId, userId }`

## Alternatives Considered

| Approach | Reason for Rejection |
|---|---|
| **Plaintext storage** | Unacceptable security risk. Database breach exposes all API keys. |
| **Hashing (bcrypt)** | Hashing is one-way — we need to recover the original value for API calls. |
| **External secrets manager (AWS KMS, Vault)** | Adds infrastructure complexity. Overkill for this project size. Good for enterprise scale. |
| **Client-side encryption** | Key management becomes the client's problem. Hard to enforce consistently. |
| **Per-user encryption keys** | More secure (breach of one key doesn't expose all credentials) but significantly more complex key management. |

## Consequences

### Positive
- Simple implementation (7 lines of code)
- Industry-standard AES-256-GCM encryption
- Database compromise does not directly expose API keys
- Transparent to the rest of the application
- Single encryption key simplifies management

### Negative
- Single `ENCRYPTION_KEY` is a critical secret — if lost, all credentials become irrecoverable
- All credentials encrypted with the same key — compromise of the key exposes everything
- Key rotation requires re-encrypting all existing credentials
- No envelope encryption (single layer)

### Risks
- `ENCRYPTION_KEY` must be stored securely (not committed to version control)
- Changing the key invalidates all existing encrypted values
- No automated key rotation mechanism

### Future Improvements

If the security requirements increase:
1. **Envelope encryption** — Use AWS KMS or similar to encrypt the encryption key itself
2. **Per-user keys** — Derive unique encryption keys per user
3. **Key rotation** — Implement online key rotation with re-encryption migration
4. **HSM** — Hardware Security Module for key storage

---

*Related: [DATABASE.md](../DATABASE.md) · [AUTHENTICATION.md](../AUTHENTICATION.md) · [CONFIGURATION.md](../CONFIGURATION.md)*
