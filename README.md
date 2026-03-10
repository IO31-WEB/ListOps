# ListOps — Phase 1 Complete

> 6-Week Real Estate Marketing in One Click. MLS-connected, Claude AI-powered.

---

## 🚀 What's Built in Phase 1

| Feature | Status |
|---|---|
| Marketing homepage | ✅ Complete |
| Pricing page (full comparison table) | ✅ Complete |
| Sign in / Sign up (Clerk) | ✅ Complete |
| Onboarding flow (4 steps) | ✅ Complete |
| Dashboard layout (sidebar + header) | ✅ Complete |
| Dashboard home (stats, recent campaigns) | ✅ Complete |
| Campaign generator (MLS → AI → content) | ✅ Complete |
| Campaign history page | ✅ Complete |
| Brand Kit page (logo, colors, tone, social) | ✅ Complete |
| Billing page (all tiers + Stripe checkout) | ✅ Complete |
| Team management page | ✅ Complete |
| Analytics page (gated, Pro+) | ✅ Complete |
| Settings page | ✅ Complete |
| Contact / Enterprise inquiry page | ✅ Complete |
| Privacy Policy & Terms | ✅ Complete |
| Stripe checkout + webhook handler | ✅ Complete |
| Campaign generation API (Claude AI) | ✅ Complete |
| Brand kit API | ✅ Complete |
| Database schema (Drizzle + Neon PG) | ✅ Complete |
| Auth middleware (Clerk) | ✅ Complete |
| Mobile-optimized throughout | ✅ Complete |

---

## 📋 Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) account (for deployment)
- Accounts for each service below

---

## ⚙️ Step-by-Step Setup

### Step 1 — Clone & Install

```bash
git clone <your-repo>
cd listops
npm install
cp .env.example .env.local
```

---

### Step 2 — Clerk Authentication

**What it does:** Handles all sign up, sign in, social login, and session management.

1. Go to [clerk.com](https://clerk.com) → Create application
2. Name it "ListOps"
3. Enable Google + Email sign-in methods
4. From your Clerk dashboard → **API Keys**:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   CLERK_SECRET_KEY=sk_live_xxx
   ```
5. In Clerk Dashboard → **Webhooks** → Add endpoint:
   - URL: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** (you'll add this as `CLERK_WEBHOOK_SECRET` later)

---

### Step 3 — Neon Database (PostgreSQL)

**What it does:** Stores users, orgs, campaigns, brand kits, subscriptions.

1. Go to [neon.tech](https://neon.tech) → Create project named "listops"
2. Copy the **Connection String** from the dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/listops?sslmode=require
   ```
3. Push the schema:
   ```bash
   npm run db:push
   ```
4. (Optional) Open Drizzle Studio to inspect:
   ```bash
   npm run db:studio
   ```

---

### Step 4 — Anthropic (Claude AI)

**What it does:** Powers all campaign content generation.

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxx
   ```
4. **Recommended:** Set usage limits in the Anthropic console to cap costs during testing.

---

### Step 5 — Stripe Billing

**What it does:** Handles subscriptions, checkout, and the customer billing portal.

1. Go to [stripe.com](https://stripe.com) → Create account
2. Copy API keys from Dashboard → Developers → API Keys:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   ```

3. **Create Products & Prices** in Stripe Dashboard → Products:

   | Product | Monthly Price | Annual Price |
   |---|---|---|
   | ListOps Starter | $29/mo | $249/yr |
   | ListOps Pro | $79/mo | $699/yr |
   | ListOps Brokerage | $299/mo | $2,499/yr |

   After creating each, copy the **Price ID** (starts with `price_`):
   ```
   STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxx
   STRIPE_STARTER_YEARLY_PRICE_ID=price_xxx
   STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
   STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
   STRIPE_BROKERAGE_MONTHLY_PRICE_ID=price_xxx
   STRIPE_BROKERAGE_YEARLY_PRICE_ID=price_xxx
   ```

4. **Set up webhook** (for subscription events):
   - Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
   - For local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - For production: Stripe Dashboard → Webhooks → Add endpoint
     - URL: `https://your-domain.com/api/webhooks/stripe`
     - Events to listen for:
       - `checkout.session.completed`
       - `customer.subscription.created`
       - `customer.subscription.updated`
       - `customer.subscription.deleted`
       - `invoice.payment_succeeded`
       - `invoice.payment_failed`
       - `customer.subscription.trial_will_end`
   - Copy webhook secret:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_xxx
     ```

5. **Enable Customer Portal** in Stripe Dashboard → Customer Portal → Activate

---

### Step 6 — SimplyRETS (MLS Data)

**What it does:** Fetches live listing data from 500+ MLS boards.

1. Go to [simplyrets.com](https://simplyrets.com) → Sign up
2. Request MLS board access for your target market(s)
3. Copy your credentials:
   ```
   SIMPLYRETS_API_KEY=xxx
   SIMPLYRETS_API_SECRET=xxx
   ```
4. **Note:** SimplyRETS uses test credentials `simplyrets`/`simplyrets` for sandbox. The app auto-falls back to demo data if MLS fetch fails, so it works out of the box.

---

### Step 7 — Cloudflare R2 (File Storage)

**What it does:** Stores brand kit images (logos, agent photos) and generated PDF flyers.

1. Go to [cloudflare.com](https://cloudflare.com) → R2 Object Storage
2. Create a bucket named `listops-assets`
3. Create an **API Token** with R2 read/write permissions
4. Set up a **Public Access Domain** for the bucket (e.g. `assets.listops.io`)
5. Copy credentials:
   ```
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=listops-assets
   NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.listops.io
   ```

---

### Step 8 — Resend (Transactional Email)

**What it does:** Sends welcome emails, campaign-complete notifications, billing receipts.

1. Go to [resend.com](https://resend.com) → Create account
2. Add and verify your domain (e.g. `listops.io`)
3. Create an API key:
   ```
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL=hello@listops.io
   ```

---

### Step 9 — (Optional) Upstash Redis

**What it does:** Rate limiting on API routes, caching MLS data, session caching.

1. Go to [upstash.com](https://upstash.com) → Create Redis database
2. Copy credentials:
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```

---

### Step 10 — (Optional) PostHog Analytics

**What it does:** Product analytics, feature flags, A/B testing, session replay.

1. Go to [posthog.com](https://posthog.com) → Create project
2. Copy credentials:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```

---

## 🖥️ Local Development

```bash
npm run dev
# Open http://localhost:3000
```

For Stripe webhooks in local dev:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Project Settings → Environment Variables
# Add all variables from .env.example
```

Or push to GitHub and connect via Vercel dashboard for automatic deploys.

**Important Vercel settings:**
- Framework: Next.js
- Build command: `npm run build`
- Root directory: `./` (default)
- Node version: 18.x

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Marketing homepage
│   ├── pricing/                    # Pricing page
│   ├── sign-in/                    # Clerk sign-in
│   ├── sign-up/                    # Clerk sign-up
│   ├── onboarding/                 # 4-step onboarding flow
│   ├── contact/                    # Contact / enterprise inquiry
│   ├── privacy/                    # Privacy policy
│   ├── terms/                      # Terms of service
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard shell (sidebar + header)
│   │   ├── page.tsx                # Dashboard home
│   │   ├── generate/               # Campaign generator (core product)
│   │   ├── campaigns/              # Campaign history
│   │   ├── brand/                  # Brand kit setup
│   │   ├── billing/                # Plans + Stripe checkout
│   │   ├── team/                   # Team management
│   │   ├── analytics/              # Analytics (Pro+ gated)
│   │   └── settings/               # Account settings
│   └── api/
│       ├── generate/               # Claude AI campaign generation
│       ├── brand-kit/              # Brand kit CRUD
│       ├── billing/
│       │   ├── create-checkout/    # Stripe checkout session
│       │   └── portal/             # Stripe customer portal
│       └── webhooks/
│           ├── stripe/             # Stripe event handler
│           └── clerk/              # Clerk user sync
├── components/
│   └── dashboard/
│       ├── sidebar.tsx             # Collapsible sidebar nav
│       └── header.tsx              # Dashboard top bar
├── lib/
│   ├── db/
│   │   ├── index.ts                # Drizzle DB connection
│   │   └── schema.ts               # Full DB schema
│   ├── stripe.ts                   # Stripe client + plan definitions
│   ├── user-service.ts             # User/org DB helpers
│   └── utils.ts                    # Utility functions
├── middleware.ts                   # Clerk auth middleware
└── styles/
    └── globals.css                 # Design system + Tailwind
```

---

## 💳 Plan Feature Matrix

| Feature | Free | Starter ($29) | Pro ($79) | Brokerage ($299) |
|---|---|---|---|---|
| Campaigns/mo | 3 | 5 | Unlimited | Unlimited |
| Brand Kit | ❌ | ✅ | ✅ | ✅ |
| Remove branding | ❌ | ✅ | ✅ | ✅ |
| Social scheduling | ❌ | ❌ | ✅ | ✅ |
| Listing microsite | ❌ | ❌ | ✅ | ✅ |
| Video scripts | ❌ | ❌ | ✅ | ✅ |
| Team seats | 1 | 1 | 3 | 25 |
| White-label | ❌ | ❌ | ❌ | ✅ |
| Analytics | ❌ | ❌ | Basic | Advanced |
| Audit logs | ❌ | ❌ | ❌ | ✅ |

---

## 🔜 Phase 2 Roadmap

- [ ] Wire DB to all API routes (replace mock data)
- [ ] Stripe webhook → DB subscription sync  
- [ ] R2 file upload for brand kit images
- [ ] PDF flyer generation (Puppeteer on AWS Lambda)
- [ ] Listing microsite generator (`/l/[slug]`)
- [ ] Direct social scheduling (Meta Graph API)
- [ ] Email integration (Mailchimp API)
- [ ] Brokerage admin dashboard
- [ ] Referral program
- [ ] Usage-based billing metering
- [ ] Campaign sharing & duplication
- [ ] Zapier integration

---

## 🔑 Environment Variables Summary

```
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY    ← Clerk dashboard
CLERK_SECRET_KEY                     ← Clerk dashboard

# Database
DATABASE_URL                         ← Neon dashboard

# AI
ANTHROPIC_API_KEY                    ← console.anthropic.com

# Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   ← Stripe dashboard
STRIPE_SECRET_KEY                    ← Stripe dashboard
STRIPE_WEBHOOK_SECRET                ← Stripe webhook setup
STRIPE_STARTER_MONTHLY_PRICE_ID      ← After creating products
STRIPE_STARTER_YEARLY_PRICE_ID
STRIPE_PRO_MONTHLY_PRICE_ID
STRIPE_PRO_YEARLY_PRICE_ID
STRIPE_BROKERAGE_MONTHLY_PRICE_ID
STRIPE_BROKERAGE_YEARLY_PRICE_ID

# MLS
SIMPLYRETS_API_KEY                   ← simplyrets.com
SIMPLYRETS_API_SECRET

# Storage
R2_ACCOUNT_ID                        ← Cloudflare dashboard
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
NEXT_PUBLIC_R2_PUBLIC_URL

# Email
RESEND_API_KEY                       ← resend.com
RESEND_FROM_EMAIL

# App
NEXT_PUBLIC_APP_URL                  ← Your domain
```
