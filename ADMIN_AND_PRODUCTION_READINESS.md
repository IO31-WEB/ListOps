# ListOps — Admin portal, production readiness, reviews removal & features audit (round 3)

Format for every section: **Status** (what I found) → **Changed** (in code) → **You still need to do** (dashboards, env vars, decisions).
Verified: `tsc --strict` clean · `next build` succeeds · **131 tests pass** (3 older tests fail identically on your original code — see §9) · live smoke test of the production build.

## 0. Deploy order

1. Run **`drizzle/0009_admin_audit_spend_retention.sql`** in Neon first (additive, idempotent).
   It adds: campaign `failure_reason`/`refunded_at`, a **partial unique index** that allows only one in-flight generation per listing, `users.deleted_at`, and the tables `ai_usage`, `stripe_events`, `outreach_emails` (+ makes sure `audit_logs` exists). If the unique-index step errors, two recent rows are `generating` for one listing — mark the older one `failed` and re-run.
2. Make sure `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `MAIL_FOOTER_ADDRESS` are set (from round 2). **No new env vars are required this round.**
3. Deploy. `vercel.json` now has a **single** cron (`/api/cron/daily`, 14:05 UTC ≈ 9–10 am US Eastern) that runs: outreach follow-ups → orphan-photo cleanup → retention purge. (Vercel Hobby allows very few cron jobs, so everything runs from one entry point.)

---

## 1. Admin portal  — `/admin`

**Status:** did not exist. The only admin-ish thing was a `debug` route (404s in production).

**Changed**
- **Access control (`lib/admin.ts`)** — hard-coded allow-list `['isaiaholiver95@yahoo.com']`. Granted only if the Clerk session is valid **and the primary email is *verified* by Clerk** (so nobody can "claim" the address with an unverified signup) and matches exactly (case-insensitive; look-alikes like `…@yahoo.com.evil.io` or `+tag` variants do not match). Non-admins get a plain **404**, so the portal's existence isn't advertised.
- **Enforced on the server, three layers:** Clerk middleware (must be signed in) → `requireAdminPage()` in the layout **and in every page** (Next layouts don't re-run on client navigation, so each page checks itself) → `requireAdminApi()` + same-origin (CSRF) check + rate limit on every admin API.
- **Pages:** *Overview* (AI spend today/month vs your caps, failed generations 24h/7d, new users, spend by day, top spenders, recent failures, user search) · *Users* (search by email, name, user id or Clerk id) · *User detail* (plan, quota used/limit, all-time total, 30-day AI spend, recent campaigns with status/failure reason/duration, recent AI calls, that user's audit trail) · *Failures* · *Audit log* (filterable).
- **Actions:** *Refund 1 generation* · *Grant N extra generations* · *Set "used this month"* — every one **requires a reason**, is atomic, and logged with before/after numbers. A refund tied to a specific campaign marks it `refunded_at`, so **it can't be refunded twice** (409 on a second attempt). "Refund" returns quota — it never touches Stripe money. Also *Close account* (type the email to confirm; soft-delete + removes the Clerk login; purged after 30 days; admin accounts can't be deleted this way).
- **"View as user"** — a **read-only** snapshot of what the user sees (plan, usage, listings, campaign contents summary, microsite links). Deliberately **not** Clerk impersonation: you can't act as them or change anything. **Every load writes `admin.view_as_user` to the audit log**, as do user lookups and searches (looking at personal data is itself a sensitive action).
- **Spend overview** is durable: every Claude call now writes to an `ai_usage` ledger (Redis only holds live counters that expire). Figures are *estimates* (token counts / flat reservations) — reconcile against the Anthropic console.
- **Failure reasons:** failed generations now store a short user-safe reason (never a stack trace) so the admin can see *why*; the full error is in Sentry.

**You still need to do**
- Sign in once with `isaiaholiver95@yahoo.com` **and confirm that address is verified in Clerk** (Clerk → Users → your user → email shows "Verified"), then open `/admin`. There is intentionally no link to it in the app; bookmark it.
- Turn on **2-factor authentication** for that account in Clerk — it's the key to everything.
- To add another admin later: add the address to `ADMIN_EMAILS` in `src/lib/admin.ts` and deploy.

---

## 2. Production-readiness audit

### 2.1 Secrets  — ✅ clean
**Status/verification:** I built the app with a unique **canary string in each of 37 secret env vars**, then searched every client bundle (44 chunks) and prerendered page. **0 leaks**, 0 secret-shaped strings (`sk_live`, `sk-ant`, `whsec_`, AWS keys). The only canaries that appear are `DMCA_AGENT_*`, which are public by law (they're printed on `/dmca`; note they're baked in at build time, so a change needs a redeploy). `.gitignore` excludes `.env*` (added in round 1); no hard-coded keys exist in the tree.
**You still need to:** rotate keys per the round-1 list — I can't see your git history. Run `git log --all --full-history -- ".env*"` and `gitleaks detect`; if anything shows up, rotate everything.

### 2.2 Rate limiting + AI spend protection  — ✅ consistent, fails closed
**Status:** found gaps this round: PDF rendering (headless browser!), brand-kit upload, referral redeem, billing sync/portal had **no limit**.
**Changed — coverage now (all fail-closed via in-memory fallback if Redis is down):** generate 5/10min · Claude routes 10–60/h each (`guardAi`) · enrich 20/h · photo upload 40/10min **+ 200/day cap** · brand-kit upload (same limiter) · PDF routes 10/10min · billing/portal/sync 10/h · referral 10/h · outreach sends 10 batches/day · invites 10/day · contact 3/h/IP · admin 60/10min. Spend caps: per-user daily, global daily/monthly (Redis) + durable ledger.
**You still need to:** set the **hard monthly limit in the Anthropic console** (the only cap a code bug can't bypass) and create the **new Upstash DB** (round 1) — until then the in-memory fallback protects each server instance only.

### 2.3 Server-side validation + ownership  — ✅ enforced, now regression-tested
**Status:** every route already required Clerk auth. Found raw/unvalidated bodies on OM builder (3 routes), referral redeem, team invite, billing portal; commercial PDF upload trusted the client's file type.
**Changed:** zod schemas on all of those; `%PDF-` magic-byte check; OM section lookup no longer echoes input; referral/invite/redeem hardened. **New automated guard-rails (`__tests__/route-safety.test.ts`)** scan *every* API route file and fail the build if a route: has no auth and isn't on the documented public list · returns raw error text · calls Claude without rate-limit/spend-cap · reads JSON without validation · is an admin route without admin+same-origin checks · skips the 18+ gate where required. (It caught two of the above on first run.) Ownership: every listing/campaign query is scoped by the signed-in user's id (404 for others' ids); team features scope by the caller's own org id, never request input.

### 2.4 Idempotency / double-submit  — ✅
| Action | Protection |
|---|---|
| Generate | In-flight check **plus a database partial-unique index** (one `generating` campaign per listing) — a true double-click race now returns 409 and refunds the quota. Dead runs auto-expire after 6 min. |
| Stripe Checkout | Stripe **idempotency key** per user+plan+interval+minute (a double-click returns the same session) + 10/h limit |
| Stripe webhook | **Event-id de-duplication** (`stripe_events`); the claim is released on failure so Stripe's retry still processes |
| Referral redeem | Atomic claim of `referred_by` — can't be applied/rewarded twice |
| Admin refund | Atomic `refunded_at` claim per campaign |
| Outreach follow-ups | Rows atomically claimed `pending → sending`; unique `(batch, recipient, step)` — overlapping crons can't double-send |

### 2.5 File uploads + orphan photos  — ✅ solid, with 2 small caveats
Verified: magic-byte type check (JPEG/PNG/WebP only), **SVG and GIF rejected** (brand-kit upload previously accepted SVG and trusted the client's declared type — fixed), **new** header-based dimension check (≤8000 px/side, ≤50 MP; also protects Claude calls from rejecting an oversized image), 4 MB cap, server-chosen keys under the user's own prefix, per-user daily cap, SSRF-safe photo fetch. Orphans: every upload is tracked; removed photos are deleted immediately; a daily job deletes anything unattached after 24 h; deleting a listing/closing an account removes its files.
**Caveats:** (1) photos uploaded **before** round 2 have no tracking row, so any old orphans from before then won't be auto-cleaned — one-off manual clean-up in the R2 console if you care. (2) Browser uploads strip location (EXIF) data by re-encoding; a direct API upload could keep it. Photos are **public by URL** (unguessable names) — don't store anything private in that bucket.

### 2.6 Prompt-injection protection  — ✅ layered (cannot be made impossible)
**Changed (`lib/prompt-safety.ts`, 9 tests):** all free text going to Claude — listing description/features, address pieces, brand-kit name/title/phone/tagline/brokerage, tone/persona, report addresses, OM fields — is **sanitized** (invisible/bidi characters stripped, length capped — also bounds token cost) and `<`/`>` neutralized so text can't forge or close our delimiter tags; long text is wrapped in `<untrusted_…>` tags; **every Claude call (all 12 sites, enforced by an automated test) now carries a security system prompt** saying tagged/uploaded/third-party content is data, never instructions; the uploaded-PDF parser is told the PDF is untrusted. Output is only parsed as JSON, rendered as escaped text, size-capped, and never used to choose a tool, URL or route. Suspected attempts are **reported to Sentry (field name + pattern only, never the content)** but never blocked, to avoid false positives.
**Residual risk (honest):** a determined user can still get odd text into *their own* campaign. The realistic harms are limited to that user's own output, token cost (capped), and cross-user effects via shared org brand kits (same sanitization applies). Watch Sentry for "Possible prompt-injection attempt".

### 2.7 Clean error handling  — ✅
All routes use `handleApiError` (generic message + request id; details to Sentry). The regression test fails if a route returns `err.message`/stack. Cron endpoints return generic errors too (verified live). Branded 404/500 pages (round 1) cover pages.

### 2.8 Backups & recovery  — ⚠ depends on your Neon plan
**Status (verified in Neon docs):** point-in-time restore exists, but the **history window is 6 hours on Free, up to 7 days on Launch, up to 30 days on Scale**. On Free that is *not* a real backup strategy. Neon "instant restore" rewinds a branch and keeps a safety backup branch. **R2** photos have no backup; I couldn't verify an object-versioning feature, so assume **none**. Clerk (logins) and Stripe (billing) are their own sources of truth; Upstash only holds disposable counters.
**Changed:** `scripts/backup-db.sh` (compressed `pg_dump` → a **private** R2 bucket, with sanity checks), `.github/workflows/db-backup.yml` (daily 06:23 UTC + manual run button), and `scripts/restore-test.sh` (refuses to touch the production host).
**You still need to:**
1. In GitHub → repo → Settings → Secrets → add: `DATABASE_URL_UNPOOLED` (Neon *direct* connection string), `BACKUP_BUCKET`, `R2_ENDPOINT`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`. Create a **separate private** R2 bucket + a token scoped to it, with a 30-day lifecycle rule on `db/`. Match `PG_VERSION` in the workflow to your Neon Postgres version. Run the workflow manually once.
2. **Simplest restore test (≈10 min, non-destructive):** in Neon create a new empty *branch* → copy its connection string → download the newest dump from the bucket → `TARGET_DATABASE_URL='…' ./scripts/restore-test.sh <file>.sql.gz` → compare the printed row counts to production → delete the branch. Repeat quarterly. (Second option inside Neon: create a branch "from a past time", connect, and check the data — that tests Neon's own PITR within your plan's window.)
3. Consider upgrading Neon to Launch for the 7-day window, and replicate the photo bucket (e.g., weekly `rclone sync` to a second bucket/provider).

### 2.9 Soft deletes / retention  — ✅ policy + enforcement
**Status:** found two real problems: there was **no way to delete a campaign**, and the Clerk `user.deleted` webhook **did nothing** (a deleted account's data stayed forever — contradicting the privacy policy). The privacy page also promised "free plan: 30 days" retention that was never enforced.
**Changed:** soft delete at the account level (`users.deleted_at` — set by the Clerk webhook or the admin "close account"; blocks all access immediately) + a **retention job** (`lib/retention.ts`, single source of truth, mirrored in the Privacy Policy): closed accounts → content + files purged and personal data **anonymized** after 30 days (the row is kept for billing/FK integrity); failed campaigns 90 days; AI usage ledger ~13 months; audit log 2 years; Stripe event ids 90 days; orphan photos 24 h; **email suppression list kept indefinitely** (needed so opted-out people are never emailed). I did *not* add soft delete to every campaign/listing table — there's no user-facing delete for campaigns to attach it to, and it would touch ~15 queries for little benefit.
**You still need to:** decide whether to add a "Delete campaign" button (not requested; say so and I'll add it with soft-delete). Review the retention numbers with your lawyer.

### 2.10 Audit logging  — ✅
Existing `audit_logs` table reused. Logged with actor, target, IP, user-agent, reason/metadata (no secrets or content): all admin lookups/views/changes/deletions · age confirmed/blocked · account closed/purged · listing deleted · checkout started · team invite · outreach batch sent/cancelled. Admins see all of it at `/admin/audit`; Brokerage owners/admins see their own team's (non-staff) events at **Team → Activity log**. Retention 2 years.

---

## 3. Reviews / social proof removed  ✅

**Removed:** the homepage "Loved by Real Estate Agents" testimonials section; the **"Sarah M., REALTOR, Austin"** quote on the sign-up page; two unused components containing invented claims ("12,400+ campaigns generated", "4.9★ average rating"); the blog's invented broker quote ("Showing requests went up 40%"); **7 blog "stat grids"** of unsourced figures (e.g. "4× more showing requests", "3.2× higher engagement", "80%+ close rate"); quantified results claims ("15–20% faster days-on-market", "40–60% more engagement" → qualitative wording); the About page's unsourced "6–8 hours per listing"; the analytics page's fake "~58s" fallback; homepage "<2 min"/"40+ assets" → "~2 min"/"35+" (free-plan minimum). Verified on the live build: no testimonial text on `/` or `/sign-up`.
**You still need to:** when you have real reviews, you need written permission, accurate attribution, no edits that change meaning, and disclosure of any incentive (FTC). Only add numbers you can substantiate. I left no placeholder markup behind.

---

## 4. Features audit

Method: for each claim I traced it to code (generation prompts/JSON schema, route, gate, UI). "Plan gating" below is what the code **enforces** (`FEATURE_GATES`), and marketing was aligned to it.

| Claim | Verdict | Action |
|---|---|---|
| 10 headline variations; MLS-ready description + bullets; neighborhood story; SEO meta; luxury / first-time-buyer / investor versions; Spanish description | ✅ generated | kept ("MLS-**ready**": you paste it into your MLS) |
| 6-week Facebook + Instagram calendar; Just Listed + Still Available emails | ✅ | kept |
| "8-template **drip sequence**" (consumer) | ⚠ real, but they're **copy templates** — nothing is sent | reworded: "8 ready-to-send templates… copy into your own email tool" |
| Print pack | ⚠ mostly real; "open house **info packet**" is a one-paragraph welcome | reworded; yard-sign rider, postcard, brochure, magazine ad kept |
| Print-ready flyer, 3 templates + 5 color schemes | ✅ | pricing said "**15+** templates" → corrected to 3 + 5 schemes |
| AI photo captions (alt text, IG caption, overlay, staging tip) | ✅ from up to 4 photos you upload (Starter+) | kept |
| Microsite (publish/unpublish, view count) | ✅ | kept. **"Microsite copy editor" ❌ didn't exist** (read + copy + regenerate only) → removed |
| Reel scripts, virtual-tour narration (4 types), TikTok / LinkedIn / X / Stories (Pro+) | ✅ | kept |
| **Hashtag strategy packs** (Pro+) | ❌ **broken** — the UI had a tab but the AI was never asked for them (always empty) | **fixed:** now generated (3 packs + posting tips); label "3 sets" |
| **Outreach "5-email drip"** (Commercial) | ❌ only email #1 was ever sent; toast said "Campaign launched" | **built:** email 1 now, follow-ups scheduled and sent by the daily cron; unsubscribed/closed/ineligible recipients skipped at send time; **Cancel scheduled follow-ups** button; honest UI/API copy. Limits: runs once a day; can't detect replies |
| **Agent performance analytics** (Brokerage) | ❌ **nothing rendered** for Brokerage users | **built:** per-agent campaigns, last-30-days, failures, microsite views, last activity (owners/admins) |
| "Compliance & audit logs" (Brokerage) | ❌ none visible | **built** a Team activity log; renamed honestly (it is not a certified compliance trail) |
| "CSV/PDF export of all campaigns" | ❌ didn't exist | **built** CSV export (formula-injection-safe); PDF dropped |
| "Admin dashboard" | ⚠ = the Team page (invites/roles) | renamed "Team management" |
| "Remove ListOps branding" (Starter+) | ❌ nothing in flyers/microsites is ListOps-branded, so there's nothing to remove | removed |
| "Priority generation (<30 s)" | ❌ unenforced; real runs take ~1–2 min | removed |
| Campaign history 7 d / 30 d / unlimited | ❌ never enforced (everyone keeps history) | now "saved in your account" for all plans |
| White-label / "custom app name & logo" | ⚠ your brokerage name/logo on outputs works via Brand Kit; custom app name doesn't exist | reworded; "custom app name" removed |
| Enterprise: custom domain, SSO/SAML/SCIM, 99.9% SLA, AI fine-tuning, Zapier/API marketplace, dedicated CSM | ❌ none built | removed; Enterprise = Brokerage + unlimited agents + annual invoicing + "custom integrations & professional services (scoped per contract)" |
| Commercial grading: traffic, consumer spend (1/3/5 mi), household income, anchor/big-box detection, ATTOM enrichment, data-push API, teaser/comps/microsite/OM, printable grade card | ✅ present | kept ("PDF grade card" = print-to-PDF) |
| Security page: "99.9% uptime SLAs", "SOC 2-grade infrastructure" | ⚠ overstated | now: hosted on Vercel/Neon (which hold SOC 2 Type II); *ListOps itself isn't certified* |

**You still need to confirm (business promises I can't verify and left in place):** "Dedicated Slack support", "Priority support", "Board/association-wide deployment" and "annual invoicing" — remove any you can't actually deliver. Also decide whether you want a real **microsite copy editor** (easy to add if wanted).

---

## 5. Everything that needs *you* (consolidated)

**Dashboards / accounts:** Anthropic hard monthly limit · new Upstash DB (pay-as-you-go) · GitHub backup secrets + private R2 backup bucket + lifecycle rule · first manual backup run + **restore test** · Clerk: 2FA + verified email on the admin account · Sentry DSNs & alerts (watch for "CSP violation", "prompt-injection", "schema drift") · PostHog replay OFF/delete old recordings (round 2) · Stripe Customer-Portal cancel enabled (round 2) · Copyright Office DMCA agent registration (round 2).
**Env vars:** none new this round (`CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `MAIL_FOOTER_ADDRESS`, `DMCA_AGENT_*`, `CSP_ENFORCE` from round 2).
**Decisions / legal review:** retention periods · privacy/terms wording changes in this round (retention, scheduled follow-ups, security page) · the service promises in §4 · whether to add campaign delete / microsite editor.

## 6. Known limitations (honest)
- Outreach follow-ups send **once a day**; replies aren't detected (sender must cancel); an outreach row stuck in `sending` after a crash is not auto-retried (prefers a missed email to a duplicate).
- Admin spend figures are estimates; reconcile with the Anthropic console.
- I couldn't exercise Clerk sign-in, Stripe, Resend, Neon or R2 from my sandbox. Verified instead: builds, types, 130 tests, a live smoke test (admin & team routes 404/deny when signed out, cron auth, secret-leak canary scan), and static route guard-rails. **Please smoke-test:** sign in as admin → `/admin` → search a user → refund; run the daily cron manually (`curl -H "Authorization: Bearer $CRON_SECRET" https://listops.io/api/cron/daily`); send a 2-step outreach to your own address and cancel.

## 9. Test status
131 pass. The 3 failures predate my changes (identical on your original upload): `plans.test.ts` ×2 expect a `commercial` entry in `PLAN_MAP`/valid-tier lists that the code defines elsewhere (stale tests; `PLAN_MAP` isn't used at runtime), and one `quota.test.ts` case re-implements billing-reset logic inside the test itself. No production impact found, but they should be cleaned up.
