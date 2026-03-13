/**
 * POST /api/commercial/upload
 *
 * Accepts a commercial property analytics PDF, uploads it to R2, parses it
 * with Claude's vision API, enriches nearby retailer data via Google Places,
 * * and stores everything in site_reports.
 *
 * Accepts PDFs from any standard commercial real estate data provider.
 * The AI extraction is format-agnostic — it reads whatever the document contains.
 *
 * Enrichment is non-blocking: if Places is unconfigured or errors, the report
 * saves with whatever was in the PDF and a warning is logged.
 *
 * Requires: commercial | brokerage | enterprise plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { siteReports, gradeWeights } from '@/lib/db/schema'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { uploadToR2 } from '@/lib/r2'
import { parsePropertyReportPdf, normalizeConsumerSpend, normalizeDemographic } from '@/lib/property-data-parser'
import { enrichWithPlacesData } from '@/lib/places-enrichment'
import { captureError } from '@/lib/monitoring'
import { rateLimitAPI } from '@/lib/ratelimit'
import { eq } from 'drizzle-orm'
import type { PlanTier } from '@/lib/plans'
import type { PropertyRetailer } from '@/lib/db/schema'

export const runtime = 'nodejs'
export const maxDuration = 180 // parse (up to 2min) + geocode + places

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimitAPI(request.headers.get('x-forwarded-for') ?? userId)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  const dbUser = await getUserWithDetails(userId)
  if (!dbUser?.organization) {
    return NextResponse.json({ error: 'User or organization not found' }, { status: 404 })
  }

  const sub = dbUser.organization.subscriptions?.[0]
  const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
  if (!canAccess(plan, 'site_analysis')) {
    return NextResponse.json(
      { error: 'Site Analysis requires the Commercial plan or higher.' },
      { status: 403 }
    )
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')

  // ── Upload raw PDF to R2 ──────────────────────────────────────
  const r2Key = `site-reports/${dbUser.organization.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
  const pdfUrl = await uploadToR2({ key: r2Key, body: buffer, contentType: 'application/pdf' })

  // ── Parse with Claude ─────────────────────────────────────────
  let parsed
  let parseError: string | null = null
  try {
    parsed = await parsePropertyReportPdf(base64, file.name)
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err)
    captureError(err instanceof Error ? err : new Error(parseError), {
      userId,
      orgId: dbUser.organization.id,
      filename: file.name,
    })
  }

  const consumerSpend = parsed?.consumerSpend
    ? {
        oneMile: normalizeConsumerSpend(parsed.consumerSpend.oneMile)!,
        threeMile: normalizeConsumerSpend(parsed.consumerSpend.threeMile)!,
        fiveMile: normalizeConsumerSpend(parsed.consumerSpend.fiveMile)!,
      }
    : null

  const demographics = parsed?.demographics
    ? {
        oneMile: normalizeDemographic(parsed.demographics.oneMile)!,
        threeMile: normalizeDemographic(parsed.demographics.threeMile)!,
        fiveMile: normalizeDemographic(parsed.demographics.fiveMile)!,
      }
    : null

  // ── Places enrichment ─────────────────────────────────────────
  // Always run to supplement data the PDF may not include.
  // If the PDF already has retailers, we still enrich and merge.
  // Failures are non-fatal — report saves with whatever data we have.
  let placesRetailers: PropertyRetailer[] = []
  let placesLat: number | null = null
  let placesLng: number | null = null
  let placesEnrichmentSource: 'google_places' | null = null

  const address = parsed?.propertyAddress ?? file.name
  const city = parsed?.propertyCity ?? null
  const state = parsed?.propertyState ?? null
  const zip = parsed?.propertyZip ?? null

  if (parsed?.propertyAddress) {
    try {
      const enrichment = await enrichWithPlacesData({ address, city, state, zip })
      placesRetailers = enrichment.retailers
      placesLat = enrichment.lat
      placesLng = enrichment.lng
      placesEnrichmentSource = 'google_places'
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)), {
        context: 'places_enrichment',
        reportAddress: address,
      })
    }
  }

  // Merge retailers: PDF-extracted data takes precedence (may have sales volume),
  // Places fills in anything the PDF missed.
  const pdfRetailers: PropertyRetailer[] = parsed?.nearbyRetailers ?? []
  const pdfNames = new Set(pdfRetailers.map((r) => r.name.toLowerCase()))
  const placesOnly = placesRetailers.filter((r) => !pdfNames.has(r.name.toLowerCase()))
  const mergedRetailers: PropertyRetailer[] = [...pdfRetailers, ...placesOnly]

  // ── Save report ───────────────────────────────────────────────
  const [report] = await db
    .insert(siteReports)
    .values({
      orgId: dbUser.organization.id,
      userId: dbUser.id,
      propertyAddress: address,
      propertyCity: city,
      propertyState: state,
      propertyZip: zip,
      propertyLat: placesLat?.toFixed(7) as any ?? null,
      propertyLng: placesLng?.toFixed(7) as any ?? null,
      source: 'manual_upload',
      rawPdfUrl: pdfUrl ?? r2Key,
      rawPdfFilename: file.name,
      consumerSpend: consumerSpend as any,
      demographics: demographics as any,
      trafficCounts: parsed?.trafficCounts ?? null,
      housingData: parsed?.housingData ?? null,
      nearbyRetailers: mergedRetailers.length > 0 ? mergedRetailers as any : null,
      parseModel: 'claude-sonnet-4-5',
      parseTokensUsed: parsed?.tokensUsed ?? null,
      parseCompletedAt: parseError ? null : new Date(),
      parseError,
    })
    .returning()

  await db
    .insert(gradeWeights)
    .values({ orgId: dbUser.organization.id })
    .onConflictDoNothing()

  return NextResponse.json({
    reportId: report.id,
    address: report.propertyAddress,
    parseStatus: parseError ? 'failed' : 'success',
    parseError,
    hasData: !parseError,
    enrichment: {
      source: placesEnrichmentSource,
      retailersFound: mergedRetailers.length,
      fromPdf: pdfRetailers.length,
      fromPlaces: placesOnly.length,
    },
  })
}
