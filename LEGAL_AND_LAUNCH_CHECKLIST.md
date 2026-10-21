# ListOps — legal risk reduction & launch checklist (round 2)

> I'm not a lawyer. Everything here is engineering implementation plus plain-English process notes.
> Items marked **⚖ REVIEW** should be looked at by a lawyer before you rely on them.

## 0. Deploy order (important)

1. Run **`drizzle/0008_legal_gates_suppression_uploads.sql`** in Neon (additive, idempotent). Do this **before** deploying.
2. Add the new env vars in Vercel → Production (see §8), then deploy.
3. Existing users will see a one-time **"Confirm your age"** screen on their next dashboard visit (by design — you have no record of their 18+ attestation). To skip it for accounts you already trust, use the optional `UPDATE` at the bottom of the 0008 file.

---

## 1. Age gate (18+)  ✅

| Layer | What it does |
|---|---|
| **Sign-up page** | Clerk's form isn't rendered until the visitor ticks *"I am 18 years of age or older, and I agree to the Terms and Privacy Policy"* (`components/auth/age-gate.tsx`). |
| **`/confirm-age` (server-enforced)** | Everyone — email *and* Google/OAuth sign-ups, and existing accounts — must pick "18 or older" (+ accept Terms) or "under 18". Stored as `age_confirmed_at`, `terms_accepted_at`, `terms_version`. |
| **Under 18** | Account is marked `age_blocked_at`, the Clerk account is deleted (best effort), user lands on `/age-blocked`. |
| **Enforcement** | Dashboard layout redirects unconfirmed/blocked users; `assertAdult()` rejects them (403) in generate, listing create, photo upload, checkout, outreach send. |

Honest limits: this is self-attestation (the industry standard for B2B tools) — it can't stop someone who lies. Bump `TERMS_VERSION` in `lib/legal.ts` when you materially change the Terms.

## 2. Fonts  ✅

Removed the Google Fonts `@import` and both `preconnect` links. Playfair Display, DM Sans and DM Mono are now served from your own domain via `next/font/local` (`src/app/fonts/`, SIL OFL licenses included alongside). Verified on the production build: **0** references to Google font hosts, 6 woff2 files emitted. CSP no longer allows Google font hosts.
Remaining Google calls are *server-side* only (Places/Geocoding in the commercial module) — those never expose a visitor's IP.

## 3. PostHog / session replay  ✅

- `disable_session_recording: true`; autocapture **off**; no anonymous person profiles; Do-Not-Track respected; **Global Privacy Control = no analytics at all** (legally relevant in California and other states).
- If replay is ever re-enabled the masks are pre-configured (all inputs, passwords, `[data-ph-mask]`), but it should then sit behind explicit consent.
- Documented in the code comment and Privacy Policy §"Analytics, Cookies & Session Replay".
- **YOU MUST ALSO (dashboard):** PostHog → Settings → **Session replay → turn OFF**, and **delete any existing recordings** (the default client setting records whenever the project toggle is on, so past sessions may exist).
- **⚖ REVIEW:** if you have EU/UK visitors, analytics cookies/local storage generally need a consent banner under ePrivacy/GDPR. Your `/gdpr` page implies compliance, so either add a consent banner or soften that page.

## 4. Marketing email (CAN-SPAM)  ✅

`lib/email.ts` is now the **only** way mail is sent, and compliance is enforced *inside* it:

| Rule | How it's enforced |
|---|---|
| Working unsubscribe link | Every marketing message gets a signed link (`/unsubscribe?e=…&t=…`, HMAC — can't be forged) in the footer **plus** `List-Unsubscribe` + one-click `List-Unsubscribe-Post` headers (Gmail/Yahoo bulk-sender rules). Visiting the page unsubscribes immediately (single page visit, no login). |
| Physical postal address | Footer on every email. **The send is refused outright if `MAIL_FOOTER_ADDRESS` isn't set.** |
| Honor opt-outs | `email_suppressions` table checked before every marketing send; unsubscribed addresses are skipped and counted in the response. |
| Honest sender | From name is the real agent ("Jane Doe via ListOps"), replies go to the agent's email, subject isn't altered. |
| Abuse limits | Outreach: validated, ≤100 recipients/request, de-duplicated, 10 batches/day/user. Invites: 10/day. |

**Footer audit — every email the app can send:**

| Email | Type | Address | Unsubscribe |
|---|---|---|---|
| Commercial outreach (`email-campaign/send`) | **Marketing** | ✅ | ✅ link + headers |
| Team invite (`team/invite`) | Transactional | ✅ | n/a (solicited by a team member; ignore-if-unexpected line included) |
| Contact-form notification (internal → you) | Transactional | ✅ | n/a |
| Clerk (sign-in codes) / Stripe (receipts) | Sent by those vendors | — | — |

Bugs fixed on the way: the invite email was sent from `onboarding@resend.dev` (Resend's test sender, which only delivers to *your own* address — invites to anyone else were silently failing) and interpolated the sender's name into HTML unescaped.
**Things to know:** only email #1 of an outreach sequence is ever sent — follow-ups are **not scheduled** (the API message now says so honestly). The agent is legally the sender of outreach; the Terms now say they need a lawful basis and must honor opt-outs. **⚖ REVIEW** whether ListOps's address alone satisfies you, or whether you also want the agent's brokerage address in outreach.

## 5. Renewal terms next to the subscribe button  ✅

`RenewalNotice` sits directly under every subscribe/upgrade button on **/pricing** (each plan card) and **Dashboard → Billing**, and the same text is shown on **Stripe Checkout** above the pay button (`custom_text.submit.message`). It states: price, billing frequency, auto-renewal, trial → first-charge wording (Brokerage 14-day trial), how to cancel (Billing → Manage subscription), access until period end / no partial refunds, taxes. Terms §"Subscriptions, Auto-Renewal & Cancellation" (`/terms#billing`) matches it word-for-word in substance — keep them in sync.
Optional: set `STRIPE_REQUIRE_TOS=true` for an explicit Terms checkbox at checkout (set your Terms/Privacy URLs in Stripe Dashboard → Settings → Public details first, or checkout will error).
**⚖ REVIEW:** "no refunds for partial periods" must match your real refund practice; California's auto-renewal law and the federal ROSCA also expect an easy online cancel — confirm the Stripe Customer Portal has *cancel subscription* enabled (Stripe Dashboard → Settings → Billing → Customer portal).

## 6. DMCA designated agent — step by step

**Why:** Registering an agent is what keeps your DMCA "safe harbor" (17 U.S.C. § 512) — it protects you from copyright liability for photos users upload. Without a registered agent you can lose that protection. You also need a published **repeat-infringer policy** (done on `/dmca`).

**What you need before you start**
- The **legal name of your company** (e.g. "ListOps LLC") and **every other name the service goes by** (ListOps, listops.io, etc.).
- The company's **mailing address** (a registered-agent or virtual-office address is fine — it becomes public).
- The **designated agent**: a person *or* a role/department (e.g. "Copyright Agent"), their **mailing address** (a P.O. box is allowed), **phone**, and a **monitored email** (use a role address like `dmca@listops.io`).
- A **credit/debit card** for the filing fee.

**Steps**
1. Go to **dmca.copyright.gov** (the Copyright Office's DMCA Designated Agent Directory — filing is electronic only).
2. Create an account (email + password) and confirm your email.
3. Click to **register a new service provider**; enter the company name and every alternate name/website.
4. Enter the **service provider's address**.
5. Enter the **designated agent's** name, address, phone and email.
6. Review, accept the certification, and **pay the fee** (the sources I checked put it at **$6**; confirm the current amount on the site before paying).
7. Save the confirmation and your **registration number**.
8. **Put the same details on your site** — set `DMCA_AGENT_NAME`, `DMCA_AGENT_COMPANY`, `DMCA_AGENT_ADDRESS`, `DMCA_AGENT_PHONE`, `DMCA_AGENT_EMAIL` in Vercel and redeploy. The `/dmca` page (linked in the footer and Terms §"Copyright Complaints") renders them. **They must match the filing exactly.**

**Ongoing requirements**
- **Renew every 3 years.** Registrations expire automatically; a lapsed one means no safe harbor. Put a recurring reminder in your calendar for ~2 years 10 months.
- **Update promptly** if the agent, address, phone, email or company name changes.
- **Actually monitor** the agent inbox and act fast on valid notices (remove/disable the content, notify the uploader). Keep a log; terminate repeat infringers.
- If you rename/add a brand or domain, add it as an alternate name.

**⚖ REVIEW:** have a lawyer glance at `/dmca` and the Terms clause once. Until you register, the page shows only the email address — it doesn't claim a registered agent.

## 7. Additional improvements

**Orphan photos** — every upload is now recorded (`listing_uploads`). Photos removed from a listing, or from a deleted listing, are deleted from R2 immediately; a daily cron (`/api/cron/cleanup-uploads`, 04:17 UTC, in `vercel.json`) deletes anything unattached after 24 h (max 300/run; Bearer-`CRON_SECRET` protected — I verified it returns 401 without it). R2 lifecycle rules can't tell "attached" from "unattached", which is why this is app-level. Set `CRON_SECRET` in Vercel or the job refuses to run.

**Photo reordering** — drag-and-drop plus ◀ ▶ buttons (keyboard/touch friendly); badges show "AI sees #1–#4"; order is saved and the server preserves it, so the first 4 are what Claude Vision gets.

**Dashboard performance** — found by reading the code and your Vercel logs (I could not run a live profile):
1. **Every `getUserWithDetails` / quota check made a live Clerk API call** (~150–400 ms) *before* touching the DB — and `/api/billing/info` fired 3–5× per page. Plan sync is now throttled to once a minute per user (`invalidatePlanSync` available), and the billing call is **de-duplicated client-side** (one shared request, 30 s cache, invalidated after generating).
2. **The campaign list loaded every column** (all generated posts/emails/scripts as JSON + each listing's `raw_data`) for 20 rows just to draw cards → now selects only the ~10 columns it renders, plus a new `(agent_id, created_at)` index.
3. **Your logs showed ~20 serverless page renders per visit to "My Campaigns"** — Next was prefetching every campaign card. Disabled (`prefetch={false}`).
4. Notification polling: every 30 s always → every 2 min, only while the tab is visible.
Measure it: Vercel → Speed Insights and Observability → compare p75 TTFB/LCP before/after.

**Realie enrichment — a real bug fixed.** Realie's current default (v3) response is *nested* (`buildingInformation.buildings[].livingArea`, `actualYearBuilt`, `garage`, `roomInformation.bedCount` …). My round-1 mapper only read flat field names and would have returned mostly empty results for v3 accounts. Rewritten against their published schema: reads v3 paths first, falls back to the legacy flat names, prefers heated *living* area over gross building area, and **reports "schema drift" (key names only, no values) to Sentry** and falls through to RentCast if a record comes back with none of the core facts. 5 fixture tests. Property *type* is only filled when unambiguous (condo / multi-family) — Realie's building-type codes need their decode table.

**CSP — moving from report-only to enforced safely**
- Report-only is already live; violations now POST to `/api/csp-report` → **Sentry issues titled "CSP violation: …"** (de-duplicated, URLs stripped of query strings).
- Tightened: no Google font hosts, `unsafe-eval` removed in production, `upgrade-insecure-requests`.
- **Procedure:** (1) set Sentry DSNs. (2) Click through sign-up → confirm-age → onboarding → dashboard → upload photos → generate → campaign page → flyer/PDF → billing → Stripe Checkout → public microsite → contact form, in Chrome *and* Safari, desktop and phone. (3) Leave report-only running for ~1 week of real traffic; add any *legitimate* blocked host to `next.config.js` (or remove the feature that needs it). (4) Set `CSP_ENFORCE=true` on **Preview** first, retest; then Production + redeploy. (5) **Rollback** = delete the variable and redeploy (or Promote the previous deployment).
- Known limitation: scripts/styles still allow `'unsafe-inline'` (Next.js bootstrap). Moving to nonces is a larger change — worth doing later, not blocking.

**Remaining MLS claims** — fixed "MLS board-wide integration / board-level licensing / Enterprise & MLS Partnerships / Enterprise-MLS Board / MLS photos will appear here" (they advertised an integration that no longer exists → "board/association deployment"), the "MLS Listing Performance" placeholder, and removed dead `mlsId` types. Kept "MLS-ready description" (accurate: agents paste it into their MLS), blog usage of "MLS" as industry vocabulary, and the optional "MLS Agent ID" profile field.

## 8. New / changed environment variables

`UNSUBSCRIBE_SECRET` (**required** for marketing email) · `MAIL_FOOTER_ADDRESS` (**required** for marketing email) · `CRON_SECRET` (**required** for cleanup job) · `DMCA_AGENT_NAME/COMPANY/ADDRESS/PHONE/EMAIL` · `STRIPE_REQUIRE_TOS` (optional) · `CSP_ENFORCE` (optional) — all documented in `.env.example`. Generate secrets with `openssl rand -base64 32`.

## 9. ⚠ Things I noticed that need YOUR decision (legal-risk, outside what you asked)

1. **Possibly fabricated testimonials / statistics.** The sign-up page shows a quote from "Sarah M., REALTOR, Austin", and a blog post quotes "…Showing requests went up 40% on the next listing." If these aren't real, consenting customers with real results, remove them — the FTC's 2024 rule on fake reviews/testimonials carries civil penalties. Same check for homepage stats. I didn't change them because I can't know whether they're real.
2. **"Drip sequence" claims.** The commercial UI/blog describe launching multi-email drips, but only email #1 is sent today. Either build the scheduler or reword.
3. **Texas governing-law / Travis County clause** in the Terms and your **refund wording** — confirm they're what you want. **⚖**
4. Privacy policy previously showed today's date as "last updated" and a `[Address]` placeholder; now a fixed date (`lib/legal.ts`) and email-only contact. Update `LEGAL_UPDATED` whenever you change the policies.

## 10. Verification performed

`tsc --strict` clean · `next build` succeeds · **96 tests pass** (29 new: footer/unsubscribe/age/renewal/Realie/security); 3 older tests in `plans.test.ts`/`quota.test.ts` fail identically on your original code · live `next start` smoke test: CSP header present, `/dmca` renders, cron returns 401 without/with wrong secret, forged unsubscribe link → 400, CSP report endpoint → 204, **0** Google-font references in the build output or served HTML.
**Not verified (needs your accounts):** the real Clerk sign-up flow with the gate, Stripe Checkout text rendering, Resend delivery/unsubscribe round-trip, Neon migration, R2 deletion, Realie live responses. Please smoke-test each once deployed.
