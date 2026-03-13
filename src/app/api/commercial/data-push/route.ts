/**
 * POST /api/commercial/data-push
 *
 * Receives structured commercial property analytics data pushed by any
 * integrated data provider or middleware (Zapier, Make.com, n8n, custom ETL).
 *
 * This is the "direct integration" path. The payload schema is provider-agnostic
 * and accepts data from any source that can POST structured JSON.
 *
 * Authentication: HMAC-SHA256 signed requests using DATA_PUSH_WEBHOOK_SECRET.
 * The secret is configured in the org's integration settings.
 *
 * Rate limit: 100 pushes/hour per org (API key based)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteReports, gradeWeights, organizations, users } from '@/lib/db/schema'
import { captureError } from '@/lib/monitoring'
import { rateLimitAPI } from '@/lib/ratelimit'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import crypto from 'crypto'
import type {
  PropertyConsumerSpend,
  PropertyDemographic,
  PropertyTrafficCount,
  PropertyHousingData,
  PropertyRetailer,
} from '@/lib/db/schema'

export const runtime = 'nodejs'

// ── Payload schema ─────────────────────────────────────────────

const ConsumerSpendSchema = z.object({
  totalSpecified: z.number(),
  apparel: z.number().default(0),
  entertainmentHobbies: z.number().default(0),
  foodAlcohol: z.number().default(0),
  household: z.number().default(0),
  transportation: z.number().default(0),
  healthcare: z.number().default(0),
  education: z.number().default(0),
})

const DemographicSchema = z.object({
  population2024: z.number(),
  populationGrowth5yr: z.number().default(0),
  medianAge: z.number().default(0),
  medianHouseholdIncome: z.number().default(0),
  avgHouseholdIncome: z.number().default(0),
  medianHomeValue: z.number().default(0),
  ownerOccupiedPct: z.number().default(0),
  bachelorsPlusPct: z.number().default(0),
  age65PlusPct: z.number().default(0),
  hispanicPct: z.number().default(0),
})

const TrafficCountSchema = z.object({
  street: z.string(),
  crossStreet: z.string().default(''),
  avgDailyVolume: z.number(),
  countYear: z.number(),
  distanceMiles: z.number(),
})

const RetailerSchema = z.object({
  name: z.string(),
  distanceMiles: z.number(),
  salesVolumeK: z.number().nullable().default(null),
  grade: z.string().nullable().default(null),
  direction: z.string().nullable().default(null),
  category: z.enum(['big_box', 'fast_food', 'fast_casual', 'grocery', 'pharmacy', 'other']).default('other'),
})

const DataPushSchema = z.object({
  // ListOps org identification — passed when configuring the webhook
  orgId: z.string().uuid(),

  property: z.object({
    address: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),

  consumerSpend: z.object({
    oneMile: ConsumerSpendSchema,
    threeMile: ConsumerSpendSchema,
    fiveMile: ConsumerSpendSchema,
  }).optional(),

  demographics: z.object({
    oneMile: DemographicSchema,
    threeMile: DemographicSchema,
    fiveMile: DemographicSchema,
  }).optional(),

  trafficCounts: z.array(TrafficCountSchema).optional(),
  housingData: z.object({
    medianHomeValue: z.number(),
    ownerOccupiedPct: z.number(),
    totalUnits: z.number(),
    medianYearBuilt: z.number(),
  }).optional(),
  nearbyRetailers: z.array(RetailerSchema).optional(),
})

/**
 * Verify HMAC-SHA256 signature on the raw request body.
 * The integration partner signs the raw body with the org's webhook secret
 * before delivery. Uses timing-safe comparison to prevent timing attacks.
 */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  // Accept both bare hex and "sha256=<hex>" formats
  const normalized = signature.replace(/^sha256=/, '')
  if (normalized.length !== expected.length) return false
  return crypto.timingSafeEqual(
    Buffer.from(normalized, 'hex'),
    Buffer.from(expected, 'hex')
  )
}

export async function POST(request: NextRequest) {
  const globalSecret = process.env.DATA_PUSH_WEBHOOK_SECRET
  if (!globalSecret) {
    return NextResponse.json({ error: 'Data push integration not configured' }, { status: 501 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-listops-signature')

  if (!verifySignature(rawBody, signature, globalSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validated = DataPushSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Schema validation failed', details: validated.error.flatten() },
      { status: 400 }
    )
  }

  const payload = validated.data

  const rl = await rateLimitAPI(request.headers.get('x-forwarded-for') ?? payload.orgId)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, payload.orgId),
  })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  if (!['commercial', 'brokerage', 'enterprise'].includes(org.plan)) {
    return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
  }

  const ownerUser = await db.query.users.findFirst({
    where: and(
      eq(users.orgId, org.id),
      eq(users.role, 'owner')
    ),
  })
  if (!ownerUser) {
    captureError(new Error(`[data-push] No owner found for org ${org.id}`), { orgId: org.id })
    return NextResponse.json({ error: 'Could not associate report with org user' }, { status: 422 })
  }

  const [report] = await db
    .insert(siteReports)
    .values({
      orgId: org.id,
      userId: ownerUser.id,
      propertyAddress: payload.property.address,
      propertyCity: payload.property.city ?? null,
      propertyState: payload.property.state ?? null,
      propertyZip: payload.property.zip ?? null,
      propertyLat: payload.property.lat ? String(payload.property.lat) : null,
      propertyLng: payload.property.lng ? String(payload.property.lng) : null,
      source: 'api_push',
      consumerSpend: payload.consumerSpend as any ?? null,
      demographics: payload.demographics as any ?? null,
      trafficCounts: payload.trafficCounts as any ?? null,
      housingData: payload.housingData as any ?? null,
      nearbyRetailers: payload.nearbyRetailers as any ?? null,
      parseModel: 'api_push_v1',
      parseCompletedAt: new Date(),
    })
    .returning()

  await db
    .insert(gradeWeights)
    .values({ orgId: org.id })
    .onConflictDoNothing()

  return NextResponse.json({ reportId: report.id, status: 'received' }, { status: 201 })
}
