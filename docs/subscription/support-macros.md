# Billing & Quota Support Macros

> For support/ops. Aligned with docs/subscription (decisions D1–D8). Last updated 2026-08-22.

---

## M1 — "Where did my agent chats go?" / quota reset

**Applies:** Free plan chat limits.

Hi {name},

The Free plan includes **25 AI agent chats per calendar month**, and the counter
resets automatically on the **1st of each month** — no action needed from you.
You can always see your remaining chats and the reset date in the sidebar usage
meter.

If you regularly need more, Pro includes **500 chats per month**
(https://a8n.app/#pricing).

---

## M2 — "Why can't I create workflow #6?"

**Applies:** Free plan workflow cap.

Hi {name},

On the Free plan you can own up to **5 workflows at a time**. Your existing
workflows keep running normally — only creating *new* ones is paused once the
cap is reached.

Two options:
1. Delete an unused workflow (Dashboard → Workflows → ⋯ → Delete) to free a slot, or
2. Upgrade to Pro for **unlimited workflows**: https://a8n.app/#pricing

Nothing was deleted on our side, and nothing will be.

---

## M3 — "I cancelled — is my data gone?" / downgrade behaviour

**Applies:** cancelled Pro subscriptions.

Hi {name},

Your Pro benefits remain active until the end of the period you already paid
for ({period_end}). After that your account moves to the Free plan.

**We never delete your data when a subscription ends.** If you have more than
5 workflows at that point they all stay intact and runnable — you just won't be
able to create new ones until you're back under the Free cap or resubscribe.

You can manage or restart your subscription anytime via **Billing Portal**
(sidebar).

---

## M4 — Refund requests

Policy (decision D4): refunds follow **Polar.sh merchant-of-record defaults**;
a8n has no in-app refund flow.

- Standard answer: cancellations take effect at period end, so most refund
  requests are resolved by confirming the service remains active until
  {period_end}.
- Goodwill refunds (edge cases only): within **14 days of charge**, once per
  customer, no questions asked. Issue manually from the Polar dashboard
  (Customers → {customer} → Payments → Refund), then log it in the billing
  tracker with date + reason.
- Anything outside that window: escalate to founder with context; do not promise.

---

## M5 — "I paid but I'm still on Free"

1. Ask for the email on the Polar receipt and the approximate payment time.
2. Ask the user to open **Billing Portal** (sidebar) and then refresh — the
   portal round-trip triggers an entitlement sync.
3. Still stuck? Check Polar dashboard → Webhooks delivery logs for their
   `subscription.*` events (look for 401/5xx), then run the reconciliation
   drill (docs/subscription/06 §7): `POST /api/cron/billing-reconcile` with the
   reconcile secret.
4. Escalate to engineering with the customer's Polar customer ID if drift
   persists past one reconciliation cycle.

---

## Internal notes (not user-facing)

- Hidden execution abuse guard: every plan silently allows max
  `EXECUTIONS_DAILY_ABUSE_GUARD` (default 100) workflow executions/day. Never
  quote this as a plan limit; if a legit power user hits it, raise the env var
  first and inform them afterwards (doc 10 D2 watchlist).
- Grandfathered accounts (more workflows than the free cap) are expected state,
  not corruption — see M3.
