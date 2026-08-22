# 07 — Security Hardening & Threat Model

> Audience: engineering/security. This doc enumerates every way the quota/billing system could be abused or corrupted, and the specific control that prevents it.
> Principle: **the client is hostile by default; entitlements are computed server-side from our DB; money state comes only from verified Polar events.**

## 1. Trust boundaries

```
Browser ──(tRPC/SSE/REST)──► a8n server ──(webhook POST)──► Polar
                │                              ▲
                └── DB is authoritative for    └── signed events are the ONLY
                    entitlement decisions          writer of Subscription rows
                                                   (besides reconcile/sync jobs)
```

Nothing the browser sends may set, extend, reset, or negotiate an entitlement. There is no "apply coupon", "extend trial", or "set plan" input anywhere in the API surface.

## 2. Threat catalogue & controls

| # | Threat | Vector | Control |
|---|---|---|---|
| T1 | Quota bypass via concurrent requests (double-click, scripted) | Race between count-check and create | Advisory-lock transaction (stock meters, doc 03 §5.1); conditional `UPDATE ... WHERE used < limit` (flow meters). DB arbitrates — no read-then-write windows. Verified by concurrency tests (doc 08 §4). |
| T2 | Forged webhook grants free Pro | POST /api/webhooks/polar with fake body | HMAC signature verification on raw bytes before parse; constant-time compare; 401 on failure; secret in env only. Alert on 401 spike (secret mismatch detector). |
| T3 | Webhook replay (attacker re-sends old valid delivery to re-trigger e.g. `subscription.created` after later cancellation) | Replayed captured request | Dedup ledger PK insert (`ProcessedWebhookEvent`) + stale-event timestamp check vs `lastSyncedAt` + `payloadHash` logged for forensics. Replay = no-op. |
| T4 | Client claims upgrade without paying (e.g., calls success-page sync endpoint repeatedly hoping for race) | `subscriptions.syncNow` abuse | Endpoint pulls truth *from Polar*, so it can never fabricate entitlements; rate-limited 3/user/hour; result identical to webhook normalizer. Worst case attacker burns their own rate limit. |
| T5 | Free-tier farming via many accounts | Signup loops | Existing email-verification infra + per-user counters keyed to `userId`; anomaly alert when >N signups share IP fingerprint (observability, not hard block — avoid punishing NAT'd offices); chat cost bounded by per-run budget regardless. Accepted residual risk documented in doc 01 §7. |
| T6 | Agent-as-free-LLM-proxy abuse within chat quota | Scripted 25 msgs × M accounts | Per-run cost budget (`assertRunBudget` wired in build P1 per D2), message length caps already present, concurrency cap (2), plus flow meter. Pro hard cap (500/month, D3) prevents subscriber abuse too. |
| T7 | Enumeration/injection through new endpoints | tRPC inputs | All inputs zod-validated as elsewhere; snapshot endpoint takes no params (session-derived userId); Prisma parameterized queries throughout — no raw SQL string building except advisory-lock call using bound parameter. |
| T8 | Downgrade wipes user data (business-logic corruption, also legal exposure) | Lifecycle bug | Grandfathering invariant: downgrade path contains **zero** delete calls; covered by dedicated test asserting data intact post-downgrade. |
| T9 | Entitlement drift (DB says pro, reality free — or reverse) causing revenue leak or false paywall | Missed webhooks, bugs | Daily reconciliation where **Polar wins**, drift logging + alerting; `syncNow` self-service repair; resolver date-comparison means even a fully dead webhook pipeline degrades gracefully at period end. |
| T10 | Timing/oracle leaks about other users | Snapshot endpoint | Returns only session owner's data; errors indistinguishable between "no subscription" and "subscription lookup failed" from outside (both → free + degraded flag internally). |
| T11 | Cron endpoint abuse | Unauthenticated trigger of reconcile job | Bearer secret required in production (pattern proven by mcp-maintenance route); job idempotent anyway. |
| T12 | Secrets leakage via logs | Observability wiring | Log fields whitelist: userId, feature, used/limit, event type/id. Never log tokens, full customer payloads, or signature headers. Follows existing `billing` component conventions (`src/lib/observability.ts`). |

## 3. Ordering invariants (the consistency contract)

These orderings are enforced in code and asserted in tests:

1. **Chat:** authn → ownership → validation → concurrency → **quota consume** → run-row upsert → dispatch. A crash at any point leaves at most one counter unit consumed with zero LLM spend — never free LLM spend.
2. **Workflow create:** lock → count → insert, one transaction. No commit path exists that exceeds the limit; no abort path leaves phantom counts (count is derived live).
3. **Webhook:** verify → dedup-insert → apply. An apply-crash before response causes Polar retry → dedup blocks re-apply → manual/reconcile completion. At-least-once delivery becomes effectively-once application.

Idempotency keys:

| Operation | Key |
|---|---|
| Webhook application | Polar `event.id` (PK) |
| Chat consumption | `(threadId, clientMessageId)` — same key as AgentRun row, preventing double-consume on client retry |
| Reconciliation upsert | natural key `userId` |

## 4. Data protection

- No new PII collected beyond what Polar already returns (ids, timestamps, status). Card data never touches our servers (Polar hosted checkout).
- `Subscription.polarCustomerId` is an external identifier, not a secret; still excluded from any client payload — snapshots expose only `{plan, usage}` shapes.
- Webhook raw bodies stored only as `payloadHash`; full payloads live in Polar's dashboard/logs if forensics ever need them.

## 5. Operational security checklist (pre-launch)

- [ ] `POLAR_WEBHOOK_SECRET`, `POLAR_PRO_PRODUCT_ID`, `POLAR_SERVER=production`, `BILLING_RECONCILE_SECRET` set via deployment secrets (not committed; `.env.prod` audited)
- [ ] Webhook URL registered in Polar dashboard over HTTPS; delivery logs enabled
- [ ] Sandbox→production cutover executed per DEPLOYMENT.md, now config-driven (removes the manual `polar.ts` edit footgun)
- [ ] Alerts armed: 401-on-webhook spike, drift>0 from reconcile, `unlinked_customer` events, checkout error rate
- [ ] Runbook written: "user paid but still shows free" (check webhook deliveries → force `syncNow` → check reconcile log), "counter suspected wrong" (compare vs AgentRun count)
- [ ] E2E fault-injection extended: `throwIfE2EFault("polar-webhook")`, `throwIfE2EFault("quota-db")` following the existing `e2e-faults` pattern

## 6. Explicit non-goals

- No DRM/license-key obfuscation layers — server-side enforcement makes client tampering irrelevant.
- No IP-based hard blocking of "abusers" — false-positive cost (shared offices, VPNs) exceeds fraud cost at this scale; monitoring-first approach.
- No storing of payment instruments, addresses, or tax data — Polar owns all of it as merchant-of-record.
