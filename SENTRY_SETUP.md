[SENTRY_SETUP.md](https://github.com/user-attachments/files/25826475/SENTRY_SETUP.md)
# Sentry Setup (5 minutes)

## Install
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

This auto-creates:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Updates `next.config.ts`

## Environment Variables (add to Vercel)
```
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=campaignai
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## What's already tracked
- All campaign generation errors (`captureError` in `/api/generate`)
- Claude API cost per generation (`trackGenerationCost`)
- Plan upgrades (`trackPlanUpgrade`)

## Cost monitoring alert
If a single generation costs > $0.10, Sentry fires an alert automatically.
Average cost should be ~$0.02–0.04 per campaign.

---

# Upstash Redis Setup (Rate Limiting)

## Create free Upstash account
1. Go to https://upstash.com
2. Create a new Redis database (free tier works)
3. Copy REST URL and REST Token

## Add to Vercel env vars
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxx
```

## Rate limits enforced
- `/api/generate` — 5 requests per 10 minutes per user
- Falls back to in-memory limits if Upstash not configured (safe for dev)

---

# Running Tests

## Install
```bash
npm install --save-dev vitest
```

## Run
```bash
npm test              # run once
npm run test:watch    # watch mode
```

## Test files
- `src/__tests__/plans.test.ts`      — feature gates, plan limits
- `src/__tests__/ratelimit.test.ts`  — rate limiter logic
- `src/__tests__/webhook.test.ts`    — Stripe webhook price mapping
