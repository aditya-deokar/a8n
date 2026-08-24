# 01 — Business Model & Non-Technical Plan

> Audience: founder, product, support, marketing. No code required.
> Technical counterpart: [03-architecture.md](03-architecture.md)

## 1. The problem with today's model

a8n currently has only two kinds of users:

- **Pro** (paying $29/mo): can create workflows and credentials.
- **Free**: cannot create *anything*. The very first click on "New Workflow" shows an upgrade modal.

This is a **"demo wall"**, not a freemium funnel. It fails for three reasons:

1. **No product experience before payment.** Users must pay to find out if a8n works for them. Most won't.
2. **The chat agent — our differentiator and our biggest cost — is free forever.** Any signed-in user can chat unlimited, burning LLM tokens with no revenue attached.
3. **Marketing already promises a Free tier that doesn't exist.** The pricing page advertises "Free $0 / Pro $29" but the app enforces "nothing unless you pay". This erodes trust and creates support tickets.

## 2. The new model in one sentence

> **Everyone gets a real free tier — 5 workflows and 25 agent chats per month — and pays only when they outgrow it.**

### Tier definitions

| Capability | Free ($0) | Pro ($29/mo) |
|---|---|---|
| Workflows owned | up to 5 | unlimited |
| Agent chat messages | 25 per calendar month | 500 per calendar month |
| Credentials | up to 10 | unlimited |
| Editing / deleting existing workflows | always allowed | always allowed |
| Running existing workflows | allowed | allowed |
| Execution history retention | last 7 days *(v2)* | full history |
| MCP API rate limit | 30 req/min | 120 req/min |
| Support | community/docs | priority email |

### Why these numbers?

- **5 free workflows** is enough to build something genuinely useful (a personal automation, a small business pipeline), which makes the product sticky. It is small enough that a serious user hits the cap within their first weeks — the natural upgrade moment is *"I want workflow #6"*, i.e., at peak engagement, not at first contact.
- **25 chats/month (~1 per workday)** lets users experience AI-assisted workflow building meaningfully, but caps our LLM cost exposure: worst case ≈ 25 × ~$0.02–0.05/run ≈ **≤ $1.25/free user/month** — comfortably under any acquisition budget, and the existing per-run hard budget (`AGENT_MAX_RUN_COST_USD`, default $0.50) bounds each run independently.
- **Credentials stay creatable for free users** (limit 10). Today credential creation is paywalled; keeping it that way would make the 5 free workflows useless, since workflows need credentials to connect to OpenAI/Slack/Gmail etc.
- **Editing/deleting/running existing content is never blocked.** Paying customers who churn, or free users over quota, never lose access to what they built. We only gate **new creation**.

### What happens when a limit is reached?

| Situation | What the user sees | What they can still do |
|---|---|---|
| Creates workflow #6 on Free | Upgrade modal: "You've used 5 of 5 workflows" + one-click checkout | Edit, run, delete existing workflows |
| Sends chat #26 in window | Composer banner: "Monthly chat limit reached" + upgrade CTA | Read all past threads; everything else |
| Downgrades from Pro with 12 workflows | Nothing breaks. Banner: "You have 12 of 5 workflows — delete some or resubscribe to create new ones" | Everything except creating workflow #13 |

Key policy decisions encoded here:

- **Grandfathering:** downgrade never deletes data. This removes the biggest fear users have about cancelling and reduces support load and chargebacks ("I lost my work!").
- **Calendar-month window for chat** (both tiers): counters reset on the 1st of each month. One sentence explains it ("25 chats/month, resets on the 1st"), it aligns the free reset with Pro's monthly billing cycle, makes every user's usage cohort-comparable for analytics, and creates a predictable re-engagement moment. *(Decision D1 — rationale in doc 10.)*
- **Pro chat = 500/month hard cap (D3),** not "unlimited": deterministic enforcement beats discretionary moderation, protects against automated abuse of the agent as a free LLM proxy, and keeps unit economics predictable. At typical usage this cap will never be felt by a human — and it can be raised via env var the week data says otherwise.

## 3. User journeys

### Journey A — New visitor → activated free user
1. Signs up (email/GitHub/Google). Polar customer record auto-created (existing behaviour).
2. Lands on dashboard. Sidebar now shows a compact usage meter: "Workflows 2/5 · Chats 18/25".
3. Builds 2–3 workflows with agent help. Hits no walls. Value established.

### Journey B — Activated free user → paying Pro
1. Tries to create workflow #6 → modal explains exactly why: "You've used 5 of 5 free workflows."
2. One click → Polar checkout (already integrated) → success page → meter disappears, limits lift instantly (webhook-driven).
3. Receipts/cancellation available via the existing Billing Portal button.

### Journey C — Pro subscriber cancels
1. Cancels via portal. Access continues until end of paid period (Polar's `current_period_end`).
2. After period ends: account silently becomes Free. If over free limits → grandfathered banner (see table above). Data untouched.

### Journey D — Abuser
1. Signs up repeatedly to farm free chats/workflows → mitigated by email verification requirement, per-user counters keyed to account, and standard rate limiting (doc 07). Determined abuse is accepted as a cost of doing business; we do not degrade honest users' experience to fight it.

## 4. Communication & copy guidelines

- **Always state the number and the reset rule** where limits are shown ("25 chats left this month — resets on the 1st").
- **Upgrade prompts are contextual, not nagware.** They appear at the moment of the blocked action, once, with a specific reason. No timed pop-ups.
- **Pricing page must match reality** before launch: update `src/components/landing/pricing.tsx` so Free says exactly what ships in v1 (5 workflows, 25 chats). Do not advertise the 7-day execution-history feature until v2 ships it.
- **Cancellation flow** should ask a single optional reason (dropdown) — feeds churn analysis, adds zero friction.
- **Support macros needed:** "Where did my chats go?" (window explanation), "Why can't I create workflow #6?" (quota + upgrade), "I cancelled, is my data gone?" (grandfathering).

## 5. Money handling rules (plain language)

- Card details, charging, invoicing and taxes stay 100% with **Polar.sh** (merchant of record). a8n servers never see card data.
- a8n learns about subscription changes via **signed webhooks from Polar**; every webhook is verified and deduplicated before acting on it.
- Entitlement changes take effect **only** from verified webhook events or an authenticated admin reconciliation job — never from anything the browser sends us.
- If our billing sync ever drifts, a daily reconciliation job compares our records against Polar's and repairs mismatches; discrepancies raise alerts.

## 6. Success metrics (first 90 days)

| Metric | Definition | Target |
|---|---|---|
| Free→paid conversion | % of signups reaching Pro within 90d | ≥ 3–5% (typical freemium) |
| Activation rate | % of new users creating ≥1 workflow in 7d | ↑ vs today (currently ~0% — creation is paywalled) |
| Limit-hit rate | % of free users hitting ≥1 limit in 30d | 10–20% (too low = limits too generous; too high = too stingy) |
| Chat cost per free user | LLM cost / active free user / month | < $1.00 |
| Webhook sync health | % of subscription states matching Polar during reconciliation | > 99.9% |
| Support tickets re: billing | tickets tagged `billing` per 100 MAU | ↓ after launch |

## 7. Risks & mitigations (business side)

| Risk | Mitigation |
|---|---|
| Free tier too generous → costs exceed revenue | Hard caps + per-run cost budget already in code + monthly review of cost metric |
| Free tier too stingy → no activation | Launch with metrics review after 30 days; numbers are config, not schema |
| Users game chats via multiple accounts | Email verification + anomaly alerts; accept residual abuse |
| Polar outage blocks upgrades | Checkout is the only path affected; enforcement uses local DB, unaffected |
| Refund/churn spikes from misunderstanding | Grandfathering policy + clear cancellation copy + support macros |

## 8. Legal/policy checklist before launch

- [ ] Terms of Service updated: Pro chat cap description (500/mo), quota descriptions, grandfathering promise, hidden execution abuse-guard disclosure (doc 10 D2)
- [ ] Privacy policy unchanged (no new PII collected)
- [ ] Pricing page copy matches shipped v1 features exactly
- [ ] Refund policy documented (default: follow Polar merchant-of-record defaults)
