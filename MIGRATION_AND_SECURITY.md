# ListOps v2 — MLS removal, security hardening & launch checklist

## 1. Architecture (new flow)

```
Agent form (/dashboard/generate)
  ├─ address ──(optional)──► POST /api/listings/enrich ──► Realie → RentCast  (server-side keys only)
  ├─ photos  ──► browser resizes to ≤2000px JPEG ──► POST /api/uploads/listing-photo
  │                (magic-byte check, 4 MB cap) ──► R2: listings/<clerkId>/<random>.jpg
  ├─ POST /api/listings        (zod-validated; photo keys must live under the caller's own prefix)
  └─ POST /api/generate {listingId}
        rate limit → AI spend cap → ownership check (agent_id) → idempotency → quota
        → first 4 photos fetched from OUR R2 host → Claude Vision + prompts → campaign saved
```

Key design choices
- **No MLS, no scraping.** Data = what the agent types + optional public-records facts + their own photos.
- **Prompts unchanged in structure.** I adapt the DB row into the shape the existing (tuned) prompts already use (`listingToPromptShape`), so output quality is preserved. Only wording changed ("MLS photos" → "photos the agent uploaded") plus a guard telling the model to treat the description as data, not instructions.
- **Enrichment is a switch:** `ENRICHMENT_PROVIDER=auto|realie|rentcast|none`. `none` hides the button; the form works fully manually.
- **Photos are required (min 1)**, 5+ recommended in the UI. Server enforces the minimum.

## 2. What was implemented (and verified)

Verified: `tsc --strict` clean, `next build` succeeds, 10 new unit tests pass.
(3 older tests in `plans.test.ts` / `quota.test.ts` fail identically on your original code — not caused by this change.)

| Area | Change |
|---|---|
| Secrets | **Repo had no `.gitignore`** → added one (`.env*` ignored, `.env.example` kept). No hard-coded keys found in the tree. |
| Auth | Every API route already called Clerk `auth()`; new routes use `requireUserId()`. Webhooks use signature verification. |
| Data isolation | All listing queries go through `listing-service.ts`, always `WHERE agent_id = <me>`. Other people's ids → 404. Photo keys are validated against the caller's own prefix. |
| Rate limits | generate, enrich, uploads, listing writes, contact form, **and all 9 other Claude routes** (`guardAi`). **Fail closed** when Redis is down (previously failed open = unlimited — that is what the deleted Upstash DB did). |
| AI spend | Per-user daily, global daily, global monthly caps in Redis (`ai-budget.ts`) + flat reservations on non-token-tracked routes. Env-configurable. |
| Input validation | zod schemas with ranges/lengths/enums, control-char + angle-bracket stripping, body-size caps, magic-byte image validation (SVG/GIF rejected). |
| Error hygiene | `handleApiError`: users get a short message + request id; details go to Sentry/logs. Removed 3 leaks: generate echoed raw Anthropic errors; two commercial routes echoed env-var names / upstream messages. |
| SSRF | Claude photo fetch only accepts URLs built from our own R2 keys + host re-check, redirects disabled. |
| Observability | Sentry via `instrumentation.ts` / `instrumentation-client.ts` (PII off, bodies/cookies stripped). Branded `not-found`, `error`, `global-error`. |
| Headers | HSTS, nosniff, frame-deny, referrer, permissions policy, **CSP in report-only** (see §6). |
| Polish | OG image (auto og:/twitter: image), `robots.ts`, `sitemap.ts`, canonical, updated meta copy, funnel analytics events, working contact form + `/api/contact`, outreach emails get reply-to + List-Unsubscribe + opt-out line. |
| Legal | Privacy + Terms updated (no MLS, photo rights, sub-processors, AI/fair-housing responsibility, public-records accuracy). Static "last updated" date instead of "today". |
| Copy | Removed false "MLS-connected / Repliers / 500+ boards" claims from home, pricing, plans, help, onboarding, blog. |
| Reliability | Quota is refunded if generation fails; real idempotency check (double-click no longer double-charges); outreach route no longer crashes the build when `RESEND_API_KEY` is absent. |

## 3. Keys to rotate (do this today)

I cannot see your git history, only the files you uploaded. Because the repo had **no `.gitignore`**, a `.env.local` could have been committed at some point. Check:
`git log --all --full-history -- ".env*"` and run `gitleaks detect` or `trufflehog git file://.` on the repo. If *anything* turns up — or you're unsure — treat every secret as compromised and rotate all of these:

1. **Anthropic** `ANTHROPIC_API_KEY` (you already replaced it; revoke the old one in console.anthropic.com)
2. **Clerk** `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
3. **Stripe** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (roll in Dashboard → Developers; update webhook endpoint secret)
4. **Neon** database password → update `DATABASE_URL`
5. **Cloudflare R2** `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
6. **Resend** `RESEND_API_KEY`
7. **Upstash** token (new database anyway — see §5)
8. **Google Places**, **ATTOM**, `DATA_PUSH_WEBHOOK_SECRET`, **PostHog** personal key
9. **Repliers / SimplyRETS**: cancel the accounts and revoke keys
Also: make the repo private if it isn't, and if secrets were ever pushed, rotating is required even after deleting them (history persists).

## 4. Migration (existing data) — order matters

1. **Run `drizzle/0007_manual_listings.sql` on Neon first** (SQL editor). It is additive/idempotent: relaxes `mls_id`/`mls_board`, adds `source`, `enrichment_*`, `photo_keys`, `updated_at`, tags all existing MLS rows `source='mls_legacy'`. Existing campaigns keep working. (`scripts/migrate.ts` only does `CREATE TABLE IF NOT EXISTS`, so it will NOT alter your existing table.)
2. Deploy the code.
3. Rename-fix: `drizzle/0006_repliers_mls_board_default. sql` had a space in the filename — renamed.
4. Legacy campaigns still display (they use stored `photos` URLs). Note: legacy Repliers CDN photo URLs may stop loading when you cancel Repliers; re-upload photos for listings you still market.
5. **Licensing:** MLS-sourced `raw_data` and photos may be restricted by your Repliers/MLS agreement. Decide a retention policy; an optional purge statement is at the bottom of 0007.

### Old MLS/Repliers code you can remove
Already gone: Repliers fetch/normalize/demo-listing code, `REPLIERS_API_KEY` and `SIMPLYRETS_*` env, SimplyRETS image host.
Safe to remove later (I left them so nothing breaks): `mlsId` in `src/types/index.ts` (3 interfaces), `listings.mls_id / mls_board / raw_data / fetched_at / expires_at` columns (after your retention window), `users.mls_agent_id`, `organizations.mls_boards`, and the Brokerage/Enterprise "MLS board-wide integration" bullets in `plans.ts`/pricing — those are product decisions for you.

## 5. Things only you can do (dashboards / DNS)

- **Anthropic hard cap:** console.anthropic.com → Settings → Limits → monthly spend limit + alert email; give ListOps its own workspace/key.
- **Upstash:** create a new Redis (your old `game-anchovy` was auto-deleted after 14 idle days). Use pay-as-you-go so it can't expire; set both env vars. Until you do, the in-memory fallback still limits abuse per server instance.
- **Vercel:** Settings → Firewall → add a rate-limit rule on `/api/*` as an outer layer; set a spend-management alert.
- **Sentry:** create a Next.js project, set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`; add an alert for new issues.
- **R2:** keep the bucket private except through the public custom domain; add a lifecycle rule (see gaps). Photos are public-by-URL with unguessable names — fine for marketing photos, don't store anything private there.
- **Email deliverability (Resend):** add the domain in Resend → add the **SPF, DKIM (and MX for return-path)** records it shows → add a DMARC record `_dmarc.listops.io TXT "v=DMARC1; p=none; rua=mailto:dmarc@listops.io"` (move to `quarantine` after a few clean weeks). Send only from `@listops.io`. Create `support@` and `privacy@` mailboxes. Keep subjects plain, avoid ALL CAPS/spam words, and set `MAIL_FOOTER_ADDRESS` (a physical address is legally required in outreach).
- **Clerk:** enable bot protection and, if wanted, restrict sign-ups to verified emails.
- **PostHog:** build a funnel: `generate_page_viewed → photos_added → generate_clicked → generate_succeeded` (+ `enrich_clicked`). No PII is sent.
- **Realie / RentCast:** create accounts, add keys. Realie requires a payment method on file to activate the API key.
- **Legal:** I updated the policies with sensible plain-English terms but I'm not a lawyer — have them reviewed. Decide if the **Texas governing law/Travis County** clause still fits, and the privacy page no longer has a street-address placeholder (contact via email only).

## 6. Flip these on after you test

- **CSP:** it ships as `Content-Security-Policy-Report-Only`. Browse the app (sign-in, billing, generate) with DevTools open, fix any violations, then rename the header in `next.config.js` to `Content-Security-Policy`.
- Next 16 warns that `middleware.ts` is deprecated in favour of `proxy.ts` — non-urgent rename.

## 7. Known gaps / honest follow-ups

- **Orphan uploads:** photos uploaded but never attached to a saved listing stay in R2. Add an R2 lifecycle rule or a nightly cleanup job.
- **Performance (<3 s):** I did not profile your live dashboard. The generate flow is inherently ~60–120 s (three parallel Claude calls) — the UI shows progress. For the dashboard, check Vercel → Speed Insights / function durations; the usual culprits are un-indexed list queries (I added an `agent_id, created_at` index) and several sequential API calls on load.
- **Photo reordering** isn't built yet (first 4 photos go to the AI).
- **Enrichment field names:** Realie/RentCast endpoints, auth and core fields (beds, baths, sqft, year built) match their docs; Realie's *feature* flags (garage/pool/fireplace) use best-guess field names and degrade to "no features" if they differ.
- I could not run the app against your real database, Clerk, R2, Realie or Anthropic accounts from my sandbox, so please smoke-test: sign up → enter address → (auto-fill) → upload 3 photos → generate → open campaign.
