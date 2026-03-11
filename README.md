[README.md](https://github.com/user-attachments/files/25904094/README.md)
# ListOps

> AI-powered real estate marketing. MLS-connected, Claude AI-powered, under 2 minutes per campaign.

---

## What ListOps Does

Paste a MLS listing ID. ListOps connects to SimplyRETS (500+ boards), pulls your listing data and photos, passes everything to Claude AI with computer vision, and generates a complete multi-channel marketing campaign in under 2 minutes.

**Every campaign produces:**

| Module | What's included | Plan |
|---|---|---|
| **Listing Copy Suite** | 10 headline variations, full MLS description, bullet points, neighborhood story, SEO meta, Spanish description, tone variants (luxury / investor / first-time buyer) | All |
| **6-Week Facebook Calendar** | 6 themed posts: Just Listed, Property Features, Neighborhood, Open House, Investment Value, Final Call | All |
| **6-Week Instagram Calendar** | 6 captions with curated hashtag packs and listing URL | All |
| **Email Campaigns (core)** | Just Listed + Still Available emails | All |
| **Print Materials** | Yard sign rider, postcard (front + back), open house info packet, brochure copy, magazine ad | All |
| **Print-Ready Flyer (PDF)** | Fully branded listing flyer | All |
| **Email Drip Sequences** | 8 templates: buyer Day 1/7/14/30, seller update, open house invite, post-showing follow-up, neighborhood market report | Starter+ |
| **AI Photo Captions** | Per-photo: Instagram caption, SEO alt text, Stories overlay, staging tip — Claude Vision analyzing actual MLS photos | Starter+ |
| **Listing Microsite Copy** | Hero headline, about section, neighborhood story, CTA copy — publish/unpublish in one click | Starter+ |
| **Video & Reel Scripts** | 6 weekly reel scripts (hook, full script, on-screen text, music suggestion) | Pro+ |
| **Virtual Tour Narration** | 4 script types: Matterport walkthrough, 30-sec highlight reel, drone voice-over, timed walkthrough | Pro+ |
| **TikTok Scripts** | 6 weekly TikTok scripts with trending audio suggestions and on-screen text | Pro+ |
| **LinkedIn Posts** | 6 weekly market-insight-led posts with hashtags | Pro+ |
| **X (Twitter) Threads** | 6 weekly 5-tweet threads | Pro+ |
| **Stories (IG + FB)** | 6 weekly 5-slide story decks with CTAs | Pro+ |
| **Hashtag Strategy Packs** | Just Listed, Luxury, and Open House packs + 6-week posting schedule | Pro+ |

---

## Plan Tiers

| | Free | Starter ($29/mo) | Pro ($79/mo) | Brokerage ($299/mo) |
|---|---|---|---|---|
| Campaigns / month | 3 | 5 | Unlimited | Unlimited |
| Brand kit | ❌ | ✅ | ✅ | ✅ |
| Email drip sequences | ❌ | ✅ | ✅ | ✅ |
| AI photo captions | ❌ | ✅ | ✅ | ✅ |
| Listing microsite | ❌ | ✅ | ✅ | ✅ |
| Campaign history | ❌ | 30 days | Unlimited | Unlimited |
| Video + reel scripts | ❌ | ❌ | ✅ | ✅ |
| Virtual tour narration | ❌ | ❌ | ✅ | ✅ |
| TikTok / LinkedIn / X / Stories | ❌ | ❌ | ✅ | ✅ |
| Priority generation (<30s) | ❌ | ❌ | ✅ | ✅ |
| Team seats | 1 | 1 | 3 | 25 |
| White-label outputs | ❌ | ❌ | ❌ | ✅ |
| Analytics dashboard | ❌ | ❌ | ❌ | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ✅ |
| Admin dashboard | ❌ | ❌ | ❌ | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | Drizzle ORM + Neon Postgres |
| Auth | Clerk v6 |
| AI | Anthropic Claude (claude-sonnet-4) with Vision |
| Payments | Stripe (subscriptions + customer portal) |
| MLS Data | SimplyRETS (500+ boards) |
| File Storage | Cloudflare R2 |
| Email | Resend |
| Analytics | PostHog |
| Rate Limiting | Upstash Redis |
| Error Tracking | Sentry |

---

## Prerequisites

- Node.js 18+
- Accounts for each service listed in [Environment Variables](#environment-variables)

---

## Setup

### 1 — Clone & Install

```bash
git clone <your-repo>
cd listops
npm install
cp .env.example .env.local
```

### 2 — Clerk Authentication

1. [clerk.com](https://clerk.com) → Create application
2. Enable Google + Email sign-in
3. **API Keys** → copy to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   CLERK_SECRET_KEY=sk_live_xxx
   ```
4. **Webhooks** → Add endpoint `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy signing secret → `CLERK_WEBHOOK_SECRET`

### 3 — Neon Database

1. [neon.tech](https://neon.tech) → Create project named `listops`
2. Copy connection string:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/listops?sslmode=require
   ```
3. Push schema:
   ```bash
   npm run db:push
   ```
4. (Optional) Drizzle Studio:
   ```bash
   npm run db:studio
   ```

### 4 — Anthropic (Claude AI)

1. [console.anthropic.com](https://console.anthropic.com) → Create API key
2. Set spending limits before testing — campaigns use vision + large context
   ```
   ANTHROPIC_API_KEY=sk-ant-xxx
   ```

### 5 — Stripe

1. [stripe.com](https://stripe.com) → API Keys:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   ```

2. **Create Products & Prices** (Dashboard → Products):

   | Product | Monthly | Annual |
   |---|---|---|
   | ListOps Starter | $29/mo | $249/yr |
   | ListOps Pro | $79/mo | $699/yr |
   | ListOps Brokerage | $299/mo | $2,499/yr |

   Copy each Price ID (`price_xxx`):
   ```
   STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxx
   STRIPE_STARTER_YEARLY_PRICE_ID=price_xxx
   STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
   STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
   STRIPE_BROKERAGE_MONTHLY_PRICE_ID=price_xxx
   STRIPE_BROKERAGE_YEARLY_PRICE_ID=price_xxx
   ```

3. **Webhook** → Add endpoint `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
   - Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

4. **Enable Customer Portal** → Dashboard → Customer Portal → Activate

### 6 — SimplyRETS (MLS Data)

1. [simplyrets.com](https://simplyrets.com) → Sign up → request board access
   ```
   SIMPLYRETS_API_KEY=xxx
   SIMPLYRETS_API_SECRET=xxx
   ```
   > **Note:** The app auto-falls back to demo listing data if credentials are missing or the fetch fails — fully functional for development without MLS credentials.

### 7 — Cloudflare R2 (File Storage)

Stores brand kit images (logos, headshots, brokerage logos) and generated PDF flyers.

1. [cloudflare.com](https://cloudflare.com) → R2 → Create bucket `listops-assets`
2. Create API Token with R2 read/write permissions
3. Set up a Public Access Domain (e.g. `assets.listops.io`)
   ```
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=listops-assets
   NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.listops.io
   ```
   > **Note:** If R2 is not configured, brand kit image uploads fall back to base64 data URLs in Postgres. Fine for development, not suitable for production.

### 8 — Resend (Transactional Email)

1. [resend.com](https://resend.com) → Add and verify your domain
   ```
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL=hello@listops.io
   ```

### 9 — Upstash Redis (Rate Limiting)

Rate limits `/api/generate` and other public-facing endpoints.

1. [upstash.com](https://upstash.com) → Create Redis database
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```

### 10 — PostHog (Product Analytics)

1. [posthog.com](https://posthog.com) → Create project
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```

### 11 — App URL

```
NEXT_PUBLIC_APP_URL=https://listops.io
```

---

## Local Development

```bash
npm run dev
# http://localhost:3000

# Stripe webhooks in local dev:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

**Vercel settings:**
- Framework: Next.js
- Build command: `npm run build`
- Node version: 18.x
- Add all env vars in Project Settings → Environment Variables

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Marketing homepage
│   ├── pricing/                        # Pricing + feature comparison table
│   ├── sign-in/ sign-up/               # Clerk auth pages
│   ├── onboarding/                     # 4-step onboarding flow
│   ├── contact/                        # Contact / enterprise inquiry
│   ├── about/ affiliates/ help/        # Marketing pages
│   ├── privacy/ terms/ security/ gdpr/ # Legal pages
│   ├── flyer/[id]/                     # Print-ready flyer page
│   ├── l/[slug]/                       # Public listing microsite
│   └── dashboard/
│       ├── layout.tsx                  # Dashboard shell (sidebar + header)
│       ├── page.tsx                    # Home — stats + recent campaigns
│       ├── generate/                   # Campaign generator (core product)
│       ├── campaigns/[id]/             # Full campaign detail + all content modules
│       ├── campaigns/[id]/flyer/       # In-dashboard flyer preview
│       ├── brand/                      # Brand kit (logo, colors, tone, social)
│       ├── billing/                    # Plans + Stripe checkout
│       ├── team/                       # Team invite + management
│       ├── analytics/                  # Analytics (Brokerage+ gated)
│       ├── referral/                   # Referral program
│       └── settings/                   # Account settings
│
├── api/
│   ├── generate/                       # Claude AI campaign generation
│   ├── campaigns/[id]/                 # Campaign GET
│   ├── campaigns/[id]/microsite/       # Microsite publish toggle
│   ├── campaigns/[id]/pdf/             # PDF generation
│   ├── brand-kit/                      # Brand kit GET + POST
│   ├── brand-kit/upload/               # R2 image upload (logo, headshot, brokerage logo)
│   ├── billing/
│   │   ├── create-checkout/            # Stripe checkout session
│   │   ├── portal/                     # Stripe customer portal redirect
│   │   ├── info/                       # Current plan + usage
│   │   └── sync/                       # Manual subscription sync
│   ├── user/profile/                   # User profile GET + PATCH
│   ├── team/invite/                    # Team invitation
│   ├── referral/                       # Referral code + stats
│   ├── referral/redeem/                # Redeem referral code
│   ├── notifications/                  # In-app notifications
│   └── webhooks/
│       ├── stripe/                     # Stripe event handler
│       └── clerk/                      # Clerk user sync
│
├── components/
│   ├── dashboard/sidebar.tsx           # Collapsible sidebar nav
│   ├── dashboard/header.tsx            # Dashboard top bar
│   ├── billing/                        # Billing components
│   ├── brand/                          # Brand kit components
│   ├── marketing/                      # Marketing page components
│   └── ui/                             # Shared UI primitives
│
└── lib/
    ├── db/index.ts                     # Drizzle DB connection (Neon serverless)
    ├── db/schema.ts                    # Full DB schema (enums, tables, relations)
    ├── plans.ts                        # SINGLE SOURCE OF TRUTH — plan defs + feature gates
    ├── user-service.ts                 # User / org / quota / subscription helpers
    ├── stripe.ts                       # Stripe client
    ├── r2.ts                           # Cloudflare R2 upload client
    ├── ratelimit.ts                    # Upstash rate limiters
    ├── monitoring.ts                   # Error capture + cost tracking
    ├── posthog.ts                      # PostHog server-side tracking
    ├── feature-flags.ts                # PostHog feature flag helpers
    └── utils.ts                        # Shared utilities
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `organizations` | Multi-tenant root — one per agent/team. Holds plan, white-label config, Stripe customer ID |
| `users` | Clerk-synced user record with org FK, role, AI persona, campaign usage counters |
| `subscriptions` | Stripe subscription state per org |
| `campaigns` | Generated campaign — FK to listing + user + brand kit. Content stored in typed JSONB columns |
| `listings` | Cached MLS listing data (24hr TTL) |
| `brand_kits` | Agent brand assets — colors, fonts, logos, social handles, disclaimer |
| `audit_logs` | Brokerage-tier compliance log |
| `referrals` | Referral tracking with enum status (pending / signed_up / upgraded) |

**Campaign content storage:** The `campaigns` table stores structured content across several columns:
- `facebook_posts`, `instagram_posts` — typed JSONB arrays
- `email_just_listed`, `email_still_available` — text
- `video_script` — JSON string `{ reelScripts[], virtualTourScripts[] }`
- `analytics` — JSONB for remaining modules: listingCopy, emailDrip, printMaterials, photoCaptions, micrositeCopy, tiktok, linkedin, xThreads, stories, hashtagPacks

---

## Feature Gates

All plan gating goes through `src/lib/plans.ts`. Never add inline plan checks elsewhere.

```ts
import { canAccess } from '@/lib/plans'

canAccess(planTier, 'brand_kit')            // Starter+
canAccess(planTier, 'listing_microsite')    // Starter+
canAccess(planTier, 'email_drip')           // Starter+
canAccess(planTier, 'photo_captions')       // Starter+
canAccess(planTier, 'microsite_copy')       // Starter+
canAccess(planTier, 'video_script')         // Pro+
canAccess(planTier, 'expanded_social')      // Pro+ (TikTok, LinkedIn, X, Stories)
canAccess(planTier, 'virtual_tour_scripts') // Pro+
canAccess(planTier, 'white_label')          // Brokerage+
canAccess(planTier, 'analytics')            // Brokerage+
```

---

## Environment Variables

```bash
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# Database
DATABASE_URL

# AI
ANTHROPIC_API_KEY

# Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_STARTER_MONTHLY_PRICE_ID
STRIPE_STARTER_YEARLY_PRICE_ID
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_YEARLY_PRICE_ID
STRIPE_BROKERAGE_MONTHLY_PRICE_ID
STRIPE_BROKERAGE_YEARLY_PRICE_ID

# MLS
SIMPLYRETS_API_KEY
SIMPLYRETS_API_SECRET

# Storage
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
NEXT_PUBLIC_R2_PUBLIC_URL

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL

# Rate Limiting
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Analytics
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST

# App
NEXT_PUBLIC_APP_URL
```

---

## Roadmap

- [ ] Direct social publishing (Meta Graph API)
- [ ] Email platform integration (Mailchimp / Klaviyo)
- [ ] Campaign duplication and editing
- [ ] Zapier / Make integration
- [ ] Brokerage SSO / SAML (enterprise add-on)
- [ ] MLS board-level API licensing
- [ ] Usage-based billing for high-volume teams
- [ ] Mobile app (iOS / Android)
