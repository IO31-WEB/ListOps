# ListOps

**Real-estate listing marketing that gets executed, not just written.**
Generate → Brand → Distribute → Measure. Next.js 16 · TypeScript (strict) · Claude · Stripe · Cloudflare R2.

> Accuracy note: this README describes what the code does **today**. Anything not live is under [Coming Next](#coming-next). Nothing in the product invents engagement numbers.

---

## What ListOps Does

1. **Generate** — The agent enters an address (optionally auto-filled from public records via Realie / RentCast), listing details and **their own photos**. Claude (with Vision on the first four photos) writes a full 6-week campaign.
2. **Brand** — Logo, headshot, colors, contact info, tagline and disclaimer from the agent's Brand Kit are applied to flyers, graphics and the microsite.
3. **Distribute** — Ready-to-post graphics (PNG/PDF), premium print flyers, a public listing microsite, outreach emails, and copy-to-clipboard for every post.
4. **Measure** — Microsite view counts today; form submissions, link clicks and a seller report are next.

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
| Commercial tools | Site analysis, property grading, ATTOM enrichment, OM builder, outreach email sequences | Commercial+ |

### Brand & Distribute
| Feature | Detail | Plan |
|---|---|---|
| **Branded Visual Kit** | Instagram post, Instagram Story, Facebook Just Listed, Facebook cover, Open House, Price Improvement — PNG. Uses brand kit + your photos. | Free: Instagram post only (watermarked) · Starter+: all six, no watermark |
| Visual Kit PDF export | Same graphics as one-page PDF | Pro+ |
| Visual Kit color schemes | 5 schemes (Brand, Navy, Charcoal, Forest, Burgundy) | Pro+ |
| **Premium print flyers** | 3 designs (Heritage, Maison, Atelier), letter size, Just Listed / Open House / Price Improvement variants, PDF download | Free: Heritage + Just Listed · Starter+: all designs & variants · Pro+: color schemes |
| Brand kit | Logo, headshot, colors, tone, contact, tagline, disclaimer, brokerage logo | Starter+ |
| Listing microsite | Public page at `/l/<slug>`; publish/unpublish; view counter; same slug is written into generated posts/emails | Starter+ |
| Outreach email | Compliant sender (unsubscribe, suppression list), scheduled follow-ups | Commercial+ |
| Team | Seat invites (Pro+ seats); team activity log, CSV export and per-agent analytics (Brokerage) | Pro+ / Brokerage |

### Platform
Admin portal (`/admin`, allow-listed, audited) · age gate (18+) · soft-delete + retention jobs · daily DB backup workflow · rate limiting + AI spend caps (fail closed) · prompt-injection guard on every Claude call · CSP (report-only by default) · Sentry · PostHog (no session replay, honors DNT/GPC) · Stripe checkout/portal with renewal terms.

---

## Coming Next

Built in this order (see [Roadmap](#roadmap)):

1. ~~Branded Visual Kit~~ — **shipped** (above)
2. Lead capture on every microsite — Schedule a Showing / Request Info forms, instant email (optional SMS) to the agent, leads dashboard with source tracking, CSV export, webhook/Zapier-ready endpoint, spam protection + consent text
3. Persistent brand + brokerage compliance profiles — required disclaimers, locked fields for brokerage admins, missing-branding warnings, Fair Housing language scanner with one-click rewrites
4. Listing performance dashboard + seller report — microsite views, form submissions, link clicks, campaign status; shareable branded report; real data only
5. Social post scheduling — Meta Business Suite / Instagram Graph API (Buffer as interim), calendar + queue + publish status; copy/export remains the fallback

After those: unique QR codes on print materials with scan analytics; Seller Approval Portal.

Not built (and not claimed): direct social publishing, CRM sync, microsite lead forms, link-click tracking, seller reports, custom domains, SSO/SCIM.

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
| Visual Kit — all 6 graphics, no watermark | ❌ | ✅ | ✅ | ✅ | ✅ |
| Visual Kit PDF export | ❌ | ❌ | ✅ | ✅ | ✅ |
| Brand kit, drip templates, photo captions, microsite | ❌ | ✅ | ✅ | ✅ | ✅ |
| Video, TikTok, LinkedIn, X, Stories, hashtag packs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Commercial site analysis & grading | ❌ | ❌ | ❌ | ✅ | ✅ |
| Team seats | 1 | 1 | 3 | 3 | 25 |
| White-label, analytics, audit logs | ❌ | ❌ | ❌ | ❌ | ✅ |

Enterprise is contact-sales and has no self-serve plan. Annual prices: Starter $249, Pro $699, Commercial $1,590, Brokerage $2,499.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React, Tailwind CSS |
| Language | TypeScript (strict) |
| Database | Drizzle ORM + Neon Postgres |
| Auth | Clerk |
| AI | Anthropic Claude (`GENERATION_MODEL`, default `claude-sonnet-5`; commercial routes `COMMERCIAL_MODEL`) with Vision |
| Property data | Realie, RentCast (public records, optional), ATTOM + Google Places (commercial) |
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
| Property data (optional) | `ENRICHMENT_PROVIDER`, `REALIE_API_KEY`, `RENTCAST_API_KEY`, `ATTOM_API_KEY`, `GOOGLE_PLACES_API_KEY` |
| Payments | `STRIPE_*` (secret, webhook, price IDs per plan) |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL` (brand assets only) |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MAIL_FOOTER_ADDRESS`, `UNSUBSCRIBE_SECRET` |
| Ops | `UPSTASH_REDIS_REST_URL/TOKEN`, `CRON_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_APP_URL` |
| Optional | `PRINT_TOKEN_SECRET` (defaults to `CLERK_SECRET_KEY`), `CSP_ENFORCE`, `STRIPE_REQUIRE_TOS`, `DMCA_AGENT_*` |

Listing photos need R2 **read + write** credentials; the bucket does not have to be public for photos, flyers or graphics.

### Tests
`npm test` (vitest). Includes guard-rail tests that scan every API route for auth, rate limiting, validation, and safe errors.

---

## Roadmap

1. ✅ One-click Branded Visual Kit
2. Lead capture on every microsite
3. Brand + brokerage compliance profiles, Fair Housing scanner
4. Listing performance dashboard + seller report
5. Social post scheduling (Meta / Instagram Graph API; Buffer interim)
6. QR codes on print materials with scan analytics
7. Seller Approval Portal

Rules for every item: reuse brand kit / microsite / Resend / R2 / PostHog; respect plan gating; keep the Free tier useful; never fabricate analytics.
