# ListOps

**Real-estate listing marketing that gets executed, not just written.**
Generate → Brand → Distribute → Measure. Next.js 16 · TypeScript (strict) · Claude · Stripe · Cloudflare R2.

> Accuracy note: this README describes what the code does **today**. Anything not live is under [Coming Next](#coming-next). Nothing in the product invents engagement numbers.

---

## What ListOps Does

1. **Generate** — The agent enters an address (optionally auto-filled from public records via Realie / RentCast), listing details and **their own photos**. Claude (with Vision on the first four photos) writes a full 6-week campaign.
2. **Brand** — Logo, headshot, colors, contact info, tagline and disclaimer from the agent's Brand Kit are applied to flyers, graphics and the microsite.
3. **Distribute** — Ready-to-post graphics (PNG/PDF), premium print flyers, a public listing microsite, outreach emails, and copy-to-clipboard for every post.
4. **Capture & measure** — Every microsite has Schedule a Showing / Request Info forms that land in a leads inbox with source tracking. Each listing has a performance page (views, call/email clicks, inquiries, downloads) and a shareable seller report. Only counts the app actually observes are shown.

There is **no MLS connection**. Data comes from what the agent types, optional public-record enrichment, and photos the agent uploads.

---

## Currently Shipped

### Generate
| Module | Detail | Plan |
|---|---|---|
| Listing copy suite | 10 headlines, MLS-ready description, bullets, neighborhood story, SEO meta, Spanish description, tone variants | All |
| 6-week Facebook + Instagram calendars | Themed weekly posts; every post links to the listing's microsite URL | All |
| Emails | Just Listed + Still Available | All |
| Print copy | Yard-sign rider, postcard, open-house packet, brochure, magazine ad | All |
| Email drip templates | 8 templates (buyer follow-ups, seller update, market report…) | Starter+ |
| Photo captions | Per-photo alt text, Instagram caption, Stories overlay, staging tip (Claude Vision) | Starter+ |
| Microsite copy | Hero, about, neighborhood, CTA | Starter+ |
| Video / reel scripts, virtual-tour narration, TikTok, LinkedIn, X threads, Stories, hashtag packs | 6-week sets | Pro+ |
| Commercial campaigns | Same generate flow as residential, with a commercial form: offering teaser, one-pager, narrative, LinkedIn-first + Facebook posts, 4-touch broker/investor email sequence, teaser microsite, one-sheet copy | All plans (campaign quota applies) |
| Sectioned OM-style copy | Editable offering-memorandum sections | Pro+ |
| Send the email sequence from ListOps | Recipient list, consent checkbox, unsubscribe + postal address in every email | Commercial+ |

### Brand & Distribute
| Feature | Detail | Plan |
|---|---|---|
| **Branded Visual Kit** | Instagram post, feature post and photo collage, two Instagram Stories, Facebook Just Listed, Open House, Price Improvement — PNG (PDF on Pro+); each graphic uses a different listing photo. Uses brand kit + your photos. | Free: Instagram post only (watermarked) · Starter+: all graphics, no watermark |
| Visual Kit PDF export | Same graphics as one-page PDF | Pro+ |
| Visual Kit color schemes | 5 schemes (Brand, Navy, Charcoal, Forest, Burgundy) | Pro+ |
| **Premium print flyers** | 3 designs (Heritage, Maison, Atelier), letter size, Just Listed / Open House / Price Improvement variants, PDF download | Free: Heritage + Just Listed · Starter+: all designs & variants · Pro+: color schemes |
| Brand kit | Logo, headshot, colors, tone, contact, tagline, disclaimer, brokerage logo | Starter+ |
| Listing microsite | Public page at `/l/<slug>`; publish/unpublish; view counter; same slug is written into generated posts/emails | Starter+ |
| **Microsite lead capture** | Schedule a Showing + Request More Info forms on every microsite; instant email alert to the agent (reply goes straight to the lead); leads inbox at `/dashboard/leads` with New / Contacted / Closed status; source tracking from `?utm_source=` / `?src=` and the referrer; consent text stored with each lead; honeypot + minimum-fill-time + link-spam checks, per-IP and per-listing rate limits, duplicate suppression | Starter+ |
| Lead CSV export | Spreadsheet-safe CSV of your leads | Pro+ |
| Lead webhook | Signed `POST` per new lead (Zapier "Catch Hook", Make, n8n, your CRM) with test button; https-only, private/internal hosts blocked | Pro+ |
| Lead SMS alert | Text to your own mobile on each lead. **Code is shipped but inactive until the Twilio env vars are set** | Pro+ (when enabled) |
| **Fair Housing language check** | Rule-based scan (no AI call) of the listing description and every generated section; flags familial-status, religion, race/national-origin, sex, disability, source-of-income, steering and "master bedroom" phrasing; one-click neutral rewrites (per rule or all safe fixes); live check on the description box before generating; generation prompts carry the same rules. Keyword safety net, not legal advice | All plans |
| **Missing-branding warnings** | Required/recommended gaps (name, brokerage, license number, disclaimer, contact, logo, headshot) on the Brand Kit page, campaign page and before generating | All plans (Starter+ for Brand Kit) |
| **Brokerage compliance profile** | Owner/admin sets a required disclaimer, brokerage license line, "Equal Housing Opportunity" toggle, optional per-agent license line, and locks brand fields (brokerage name/logo, agent/team logo, colors, tagline) for every agent. Applied to flyers, graphics, microsites and generated copy; agents cannot remove it | Brokerage+ |
| **Listing performance dashboard** | `/dashboard/campaigns/[id]/performance`: microsite views (30 days, 7 days, all time) with a daily chart, call/email button clicks, inquiries by type and source, flyer PDF and graphic downloads, campaign age, and what content is ready. Views exclude crawlers/link-preview bots and the signed-in owner; they are page views, not unique people. Social reach/clicks are deliberately not shown (no platform data exists) | Starter+ |
| **Seller report** | Private revocable link `/r/<token>` — branded page with the same real numbers, an optional agent note, print / save-as-PDF. Shows counts only, never buyers' names or contact details; not indexed; stops working if revoked or the plan lapses | Pro+ |
| **Seller approval portal** | `/dashboard/campaigns/[id]/approval`: choose what to include (listing headline + description, Facebook/Instagram/LinkedIn posts, Just Listed email), add a note, and get a private revocable link `/a/<token>`. The seller sees the exact text (a snapshot, so later edits can't change what they approved), answers **Approve** or **Request changes + comment** for each item, types their name, and can revise until you close the link. You are emailed each time they answer; the agent page shows status per item, comments, opens and timestamps. It is a dated record of review, **not a legal e-signature** and not a listing agreement. The link isn't emailed to the seller by ListOps — you copy and send it | Pro+ |
| **Trackable QR codes** | Each flyer (Starter+, published microsite) carries a QR code automatically; the performance page can create one per placement (yard sign, open-house sign-in, brochure, postcard) and download it as print-ready SVG. The QR encodes a short `listops.io/q/<code>` link that counts the scan and redirects to the listing microsite (with `utm_source=qr&utm_campaign=<placement>`, so resulting inquiries show a QR source). Counts exclude bots, your own signed-in scans and over-limit floods; they are scans, not unique people. No IP or device is stored. Codes can't be deleted so printed signs keep working | Starter+ |
| **Social calendar** | `/dashboard/social`: puts each Facebook, Instagram and LinkedIn post from a campaign on a dated calendar (suggested slots spread across each week; every date/time is editable). Per post: copy, open the network, edit text, reschedule, notes, mark posted / skip. Length-limit and Fair Housing hints while editing. Daily email when posts are due (can be turned off), CSV and `.ics` export. **Posting is manual** — ListOps does not post to your accounts and shows no reach or engagement numbers | Pro+ |
| Outreach email | Compliant sender (unsubscribe, suppression list), scheduled follow-ups | Commercial+ |
| Team | Seat invites (Pro+ seats); team activity log, CSV export and per-agent analytics (Brokerage) | Pro+ / Brokerage |

### Platform
Admin portal (`/admin`, allow-listed, audited) · age gate (18+) · soft-delete + retention jobs · daily DB backup workflow · rate limiting + AI spend caps (fail closed) · prompt-injection guard on every Claude call · CSP (report-only by default) · Sentry · PostHog (no session replay, honors DNT/GPC) · Stripe checkout/portal with renewal terms.

---

## Coming Next

Built in this order (see [Roadmap](#roadmap)):

1. ~~Branded Visual Kit~~ — **shipped** (above)
2. ~~Lead capture on every microsite~~ — **shipped** (above)
3. ~~Persistent brand + brokerage compliance profiles~~ — **shipped** (above)
4. ~~Listing performance dashboard + seller report~~ — **shipped** (above)
5. ~~Social post scheduling~~ — **shipped as a calendar + queue + daily reminder** (above); **direct publishing through Meta (Facebook/Instagram Graph API) is not built** — it needs your own Meta developer app and App Review, see `V10_SOCIAL.md`

6. ~~QR codes on print materials with scan analytics~~ — **shipped** (above)

7. ~~Seller Approval Portal~~ — **shipped** (above)

Everything on the original roadmap is now shipped except direct Meta publishing, which needs your Meta app review (see `V10_SOCIAL.md`).

Not built (and not claimed): direct posting to Facebook/Instagram/LinkedIn (needs Meta app review), TikTok/Stories/X-thread scheduling, social-post reach/clicks (needs platform APIs), unique-visitor counts, emailing the report to the seller from inside ListOps, a PDF file of the seller report (print/save as PDF instead), per-state advertising-rule engines (the profile is a text/lock tool, not a legal rules database), AI-assisted Fair Housing rewrites, scanning of already-published social posts, direct social publishing, native CRM sync (use the webhook), webhook retries, auto-reply to the lead, link-click tracking, seller reports, custom domains, SSO/SCIM.

---

## Plan Comparison (matches `src/lib/plans.ts`)

| | Free | Starter $29 | Pro $79 | Commercial $179 | Brokerage $299 |
|---|---|---|---|---|---|
| Campaigns / month | 3 | 5 | Unlimited | Unlimited | Unlimited |
| Listing copy, 6-week FB/IG, emails, print copy | ✅ | ✅ | ✅ | ✅ | ✅ |
| Print flyer — Heritage, Just Listed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flyer designs (Maison, Atelier) + Open House / Price Improvement | ❌ | ✅ | ✅ | ✅ | ✅ |
| Flyer & graphic color schemes | ❌ | ❌ | ✅ | ✅ | ✅ |
| Visual Kit — Instagram post (watermarked on Free) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Visual Kit — all graphics, no watermark | ❌ | ✅ | ✅ | ✅ | ✅ |
| Visual Kit PDF export | ❌ | ❌ | ✅ | ✅ | ✅ |
| Brand kit, drip templates, photo captions, microsite | ❌ | ✅ | ✅ | ✅ | ✅ |
| Trackable QR codes (auto on flyers, scan counts per placement) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Microsite lead forms + leads inbox + email alerts | ❌ | ✅ | ✅ | ✅ | ✅ |
| Per-listing performance dashboard (real tracked counts) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Shareable branded seller report | ❌ | ❌ | ✅ | ✅ | ✅ |
| Seller approval portal (approve / request changes per item, emailed to you) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Social post calendar, daily due-email, CSV/.ics export (manual posting) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Fair Housing language check + one-click rewrites, branding warnings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Brokerage compliance profile (required disclaimer, locked fields) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Lead CSV export, webhook, SMS alert (SMS needs Twilio) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Video, TikTok, LinkedIn, X, Stories, hashtag packs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Commercial/Residential tab + commercial campaigns (CRE package, teaser microsite, one-sheet) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Sectioned OM-style copy | ❌ | ❌ | ❌ | ✅ | ✅ |
| Investment snapshot, financing scenario, Offering Readiness score (pure math, zero cost) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Send broker/investor email sequence from ListOps | ❌ | ❌ | ❌ | ✅ | ✅ |
| Team seats (`SEAT_LIMITS` in `src/lib/plans.ts`) | 1 | 1 | 2 | 2 | 25 |
| White-label, analytics, audit logs | ❌ | ❌ | ❌ | ❌ | ✅ |

Enterprise is contact-sales and has no self-serve plan. Annual prices: Starter $249, Pro $699, Commercial $1,590, Brokerage $2,499.

---

## Plan Gating & Seats (read before adding a feature)

- **Single source of truth:** `src/lib/plans.ts` (`FEATURE_GATES`, `canAccess`, `SEAT_LIMITS`, `seatLimitFor`, `planFromPriceId`). Never hard-code plan arrays in routes or components.
- **Effective plan:** always `resolvePlan(user)` (`src/lib/plan-resolve.ts`), never `org.plan` directly. The org subscription is the only source of a paid plan. A non-owner member inherits it only while the subscription is `active`/`trialing` and the plan has 2+ seats; the owner also keeps access through `past_due`.
- **Commercial** is hard-gated (`commercial_campaigns`, Commercial and above) at: generate, listings create/update, regenerate, outreach, campaign GET/PDF/visual-kit/microsite/approval/seller-report/social-schedule, public microsite/flyer/brochure renderers, sidebar, generate tab and `/dashboard/commercial`. `isCommercialLocked()` is the shared renderer rule. Generation only produces assets the tier includes (photo captions, microsite copy, Pro social set are conditional).
- Seat limits: Free/Starter 1, Pro 2, Commercial 2, Brokerage 25, Enterprise custom.

## Team Invites & Referrals

- **Invite flow:** owner/admin `POST /api/team/invite` → single-use, email-bound token (SHA-256 hashed, 256-bit, 7-day expiry) mailed as `/invite/<token>`. The invitee signs up/in with the same verified email; `acceptTeamInvite` attaches them to the inviter's org with a single conditional UPDATE (post-race seat recount, revert on overflow). Seats count members plus live pending invites. Only owners can invite admins; max 10 invites/org/24h; `DELETE /api/team/invite` revokes; `DELETE /api/team/members/[id]` removes a member (they get a free solo workspace).
- **Plan changes:** Stripe webhook and billing sync call `enforceSeatLimits` (detach surplus members, revoke surplus invites). Checkout/portal are owner-only.
- **Referrals:** `referrals.source` is `link` or `team`. Team invitees are never counted as referrals. Link referrals (`/sign-up?ref=` → `/join`) are claimed once, within 14 days, never self/same-org; they become `upgraded` only via the Stripe webhook when the referred person's own org has an active paid subscription. The "free month" credit is **not automated** (manual, no cost).
- **Migration:** run `drizzle/0018_team_invites_referral_source.sql` before deploying (creates `team_invites`, adds `referrals.source`, resets `organizations.max_agents`).

## Commercial Differentiators (zero cost)

`src/lib/commercial/metrics.ts` computes price/SF, price/unit, implied cap rate, a financing scenario (loan, debt service, DSCR) and an Offering Readiness score purely from entered data; rendered by `CommercialInsights` on commercial campaigns. No paid APIs, scraping or third-party data. Nothing from the cres-os repo was ported.

## SEO & AI Discoverability

- `src/lib/seo.ts` holds `pageMetadata()` (title/description/canonical/OG/Twitter) and JSON-LD builders (Organization, WebSite, SoftwareApplication generated from `PLANS`, FAQPage, BlogPosting, BreadcrumbList). Root layout title template is `%s | ListOps`; the layout sets no canonical, so each page declares its own.
- Public pages: `/`, `/features`, `/commercial`, `/pricing`, `/blog`, `/blog/[slug]`, `/help`, `/about`, `/contact`, `/affiliates`, legal pages. `sitemap.ts` (blog `lastModified` from `updated`), `robots.ts` (search and AI crawlers allowed on public content; private/tokenized routes disallowed), `/llms.txt` and `/llms-full.txt` (generated from `PLANS`/`FEATURE_GATES`/blog).
- Public copy states what ListOps does not do (no MLS feed, scraping, comps).
- Blog: set `updated` whenever a post is refreshed. Renamed slugs have permanent redirects in `next.config.js`.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React, Tailwind CSS |
| Language | TypeScript (strict) |
| Database | Drizzle ORM + Neon Postgres |
| Auth | Clerk |
| AI | Anthropic Claude (`GENERATION_MODEL`, default `claude-sonnet-5`) with Vision |
| Property data | Realie, RentCast (public records, optional; residential only) |
| Payments | Stripe |
| Storage | Cloudflare R2 (listing photos served via `/api/photos/*`; brand assets via public bucket URL) |
| Images / PDF | `next/og` (satori) for graphics, `pdf-lib`, headless Chromium (`@sparticuz/chromium` + `puppeteer-core`) for flyer PDFs |
| Email | Resend |
| Rate limiting | Upstash Redis (fails closed) |
| Monitoring / analytics | Sentry, PostHog |
| Hosting | Vercel (daily cron `/api/cron/daily`) |

---

## How the Visual Kit & Flyers Work

- `src/lib/visual-kit/` — `catalog.ts` (sizes, plan gates), `data.ts` (listing + brand kit + R2 images → data URIs; WebP is skipped), `render.tsx` (fixed templates).
- `GET /api/campaigns/[id]/visual-kit?kind=…&format=png|pdf` — auth → ownership → rate limit → plan gate → render. Nothing is stored.
- Flyers: `/flyer/[id]?template=&scheme=&badge=&date=&time=&was=`. The page enforces plan limits server-side. PDF download = `POST /api/campaigns/[id]/pdf`, which renders the flyer in headless Chromium using a 3-minute signed token (`lib/print-token.ts`) because the renderer has no login.
- Graphics use the renderer's built-in font (single weight); flyers use self-hosted Playfair Display + DM Sans.

---

## How Performance Tracking Works

- Table `campaign_events` (migration `drizzle/0012_performance.sql`): one counter per campaign / day (America/New_York) / kind, bumped by an atomic upsert in `lib/performance/record.ts`. No personal data is stored. Kinds: `view`, `click_call`, `click_email`, `flyer_pdf`, `kit_download`, `report_view`.
- Sources of truth: microsite page render (bots and the signed-in owner skipped), `POST /api/l/[slug]/event` (public; only the two click kinds; per-IP + per-listing limits), the flyer PDF route, and the visual-kit route when `download=1`. The old all-time `microsite_views` counter is kept and now increments atomically.
- Daily history starts when this shipped; earlier views appear only in the all-time total and the page says so.
- Seller reports: table `seller_reports` (192-bit token, revocable, open counter). Creating a new link revokes the old one. Code: `src/lib/performance/`, `src/app/dashboard/campaigns/[id]/performance/`, `src/app/r/[token]/`.

---

## How Commercial Works

- Commercial is a **campaign type**, not a separate product. `campaigns.campaign_type` is `'residential'` (default) or `'commercial'`; commercial details live in `listings.commercial` (JSON) and the type is derived server-side from that, so it can't be spoofed. Migration: `drizzle/0016_commercial_campaigns.sql`.
- `/dashboard/generate` has a Residential | Commercial toggle (`?type=commercial` preselects it). Required: address, use type, size (SF, units or acres), photos. Everything else (price guidance, NOI, cap rate, zoning, occupancy, broker remarks) is optional and only appears in copy when you provide it. No ATTOM, comps or traffic data is used or required.
- `POST /api/generate` branches after the shared quota/campaign steps into two parallel Claude calls (offering copy with photo vision; social + email outreach). Output is validated by `src/lib/commercial/output.ts`; a failed save refunds the quota.
- Outputs are stored in `campaigns.analytics.commercial` and mirrored into the residential-shaped fields (`facebookPosts`, `analytics.linkedin`, `listingCopy`, `micrositeCopy`) so the social calendar, approval portal, microsite and flyer keep working.
- `/dashboard/commercial` lists commercial campaigns. Sending the email sequence: `POST /api/campaigns/[id]/outreach` (Commercial+); existing scheduled follow-ups still send and can be cancelled.
- Removed: site reports, property grading, ATTOM/Places enrichment, comps, the report dashboard and all `/api/commercial/*` routes. The old tables stay in the database (no destructive migration).

## How the Seller Approval Portal Works

- Tables `approval_requests` (token, snapshot of the items, views, submitted/revoked timestamps) and `approval_responses` (one row per item: decision, comment, the name the seller typed, time), migration `drizzle/0015_seller_approval.sql`.
- Creating a link snapshots the chosen content and revokes any earlier link for that campaign. The seller must answer every item; "Request changes" requires a comment. Submitting again replaces their earlier answers (same link), until you close it.
- Public routes `/a/<token>` and `POST /api/a/<token>/respond`: 192-bit token, per-IP and per-token rate limits, no IP or device stored, noindex, only works while your plan includes the feature.
- Status: *approved* only when every item is approved; any "changes" makes it *changes requested*.

---

## How QR Codes Work

- Tables `qr_codes` (one short code per campaign + placement) and `qr_scans` (per-day counter), migration `drizzle/0014_qr_codes.sql`.
- The QR is generated in-house (`src/lib/qr/encode.ts`, no dependency): byte mode, error-correction M, versions 1–10, verified against an independent decoder. It encodes only our own short link, never the destination.
- `/q/<code>` is public: it skips bots, the signed-in owner and over-limit traffic, adds 1 to today's counter, and 302s to the campaign's microsite (fixed path, so it can't be used as an open redirect). Unknown or unpublished codes go to the home page.
- Scan counts and microsite views are separate numbers; a scan that doesn't finish loading the page is still a scan.

---

## How Social Scheduling Works

- Tables `social_posts` and `social_settings` (migration `drizzle/0013_social_queue.sql`). One row per queued post; unique on (campaign, source key), so scheduling the same campaign twice never duplicates.
- "Add to calendar" takes a start date in your time zone (set in your account) and queues the campaign's Facebook, Instagram and LinkedIn posts: week N goes out N-1 weeks after the start date, with defaults of Facebook on the start weekday at 10:00, Instagram the next day at 12:00, LinkedIn the day after at 09:00. These are convenient defaults, **not** claims about best times. Daylight-saving shifts are handled.
- Status "due"/"overdue" is computed when you open the page; only draft/scheduled/posted/skipped are stored.
- The daily cron (`/api/cron/daily`) emails each Pro+ agent the posts due in the next 24 hours (once per post) unless they turned it off.
- No data comes back from the networks, so there are no reach/engagement numbers anywhere in this feature.

---

## How Compliance Works

- `src/lib/compliance/` — `brand.ts` (locks + forced disclaimer, pure), `warnings.ts` (missing-branding checker, pure), `fair-housing.ts` (rules + rewrites, pure, browser-safe), `load.ts` (server loader).
- One resolver, four consumers: flyer page, visual-kit data, microsite page and the generate route all call `loadEffectiveBrandKit()`, so a locked field or required disclaimer cannot be bypassed by editing a URL or the Brand Kit form. The profile only applies while the org's plan includes it.
- Disclaimer order: required text, broker license, agent license (if enabled), the agent's own text, Equal Housing — each once, so clipping never drops the required part.
- `GET/POST /api/campaigns/[id]/compliance` scans and rewrites campaign copy plus the listing description. `GET/PUT /api/team/compliance` is owner/admin only, same-origin, audited. Table: `org_compliance` (migration `drizzle/0011_org_compliance.sql`).
- Locked values are copied from the admin's own Brand Kit when saved (re-save after changing it).

---

## How Lead Capture Works

- Public form → `POST /api/l/[slug]/lead` (no login). Order: per-IP limit → per-listing limit → zod validation (consent required) → bot checks (bots get a fake success) → published-microsite check → owner plan gate → 10-minute duplicate check → insert → respond. Email / SMS / webhook delivery runs **after** the response (`after()`), and the lead is already saved, so a failed alert never loses a lead; failures show on the lead in the dashboard.
- Tables: `leads`, `lead_settings` (migration `drizzle/0010_leads.sql`). The visitor's IP is stored only as a salted hash. Leads are deleted with the campaign/account.
- Webhook payload: `{ event, id, createdAt, type, name, email, phone, message, preferredDate, preferredTime, consent, source, property, campaignId }`. Headers: `X-ListOps-Event`, `X-ListOps-Timestamp`, `X-ListOps-Signature: sha256=<HMAC-SHA256(secret, timestamp + "." + body)>`. One attempt, 5 s timeout, redirects not followed.
- Code: `src/lib/leads/` (sanitize, input, csv, webhook, message, sms, service), `src/components/microsite/lead-form.tsx`, `src/app/dashboard/leads/`.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate           # or run drizzle/*.sql in order in the Neon console
npm run dev
```

Key environment variables (full list with comments in `.env.example`):

| Group | Variables |
|---|---|
| Auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Database | `DATABASE_URL` |
| AI | `ANTHROPIC_API_KEY`, `GENERATION_MODEL`, `COMMERCIAL_MODEL`, `AI_*_BUDGET_USD` |
| Property data (optional) | `ENRICHMENT_PROVIDER`, `REALIE_API_KEY`, `RENTCAST_API_KEY` |
| Payments | `STRIPE_*` (secret, webhook, price IDs per plan) |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL` (brand assets only) |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MAIL_FOOTER_ADDRESS`, `UNSUBSCRIBE_SECRET` |
| Ops | `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_APP_URL` |
| Optional (SMS lead alerts) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Optional | `PRINT_TOKEN_SECRET` (defaults to `CLERK_SECRET_KEY`), `CSP_ENFORCE`, `STRIPE_REQUIRE_TOS`, `DMCA_AGENT_*` |

Listing photos need R2 **read + write** credentials; the bucket does not have to be public for photos, flyers or graphics.

### Tests
`npm test` (vitest). `team.test.ts` covers seats, plan inheritance, invite rules and wiring; `commercial.test.ts` covers the commercial gates and metrics. Includes guard-rail tests that scan every API route for auth, rate limiting, validation, and safe errors.

---

## Roadmap

1. ✅ One-click Branded Visual Kit
2. ✅ Lead capture on every microsite
3. ✅ Brand + brokerage compliance profiles, Fair Housing scanner
4. ✅ Listing performance dashboard + seller report
5. ✅ Social post calendar + queue + reminders (direct Meta publishing still to come)
6. ✅ QR codes on print materials with scan analytics
7. ✅ Seller Approval Portal

Rules for every item: reuse brand kit / microsite / Resend / R2 / PostHog; respect plan gating; keep the Free tier useful; never fabricate analytics.
