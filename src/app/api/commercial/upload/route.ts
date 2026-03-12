/**
 * POST /api/commercial/upload
 *
 * Accepts a CoStar PDF, uploads it to R2, parses it with Claude,
 * and stores the structured data in costar_reports.
 *
 * Requires: commercial | brokerage | enterprise plan
 * Rate limit: 10 uploads / hour per org (PDF parsing is expensive)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { costarReports, gradeWeights } from '@/lib/db/schema'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { uploadToR2 } from '@/lib/r2'
import { parseCostarPdf, normalizeConsumerSpend, normalizeDemographic } from '@/lib/costar-parser'
import { captureError } from '@/lib/monitoring'
import { rateLimitAPI } from '@/lib/ratelimit'
import { eq } from 'drizzle-orm'
import type { PlanTier } from '@/lib/plans'

export const runtime = 'nodejs'
export const maxDuration = 120 // PDF parsing can take up to 2 min

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit per user (not org) to prevent abuse within a shared plan
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

  const plan = (dbUser.organization.plan ?? 'free') as PlanTier
  if (!canAccess(plan, 'costar_integration')) {
    return NextResponse.json(
      { error: 'CoStar integration requires the Commercial plan or higher.' },
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

  // Upload raw PDF to R2 for archival/re-parsing
  const r2Key = `costar-reports/${dbUser.organization.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
  const pdfUrl = await uploadToR2({ key: r2Key, body: buffer, contentType: 'application/pdf' })

  // Parse with Claude
  let parsed
  let parseError: string | null = null
  try {
    parsed = await parseCostarPdf(base64, file.name)
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err)
    captureError(err instanceof Error ? err : new Error(parseError), {
      userId,
      orgId: dbUser.organization.id,
      filename: file.name,
    })
  }

  // Build normalized data (null if parse failed)
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

  const [report] = await db
    .insert(costarReports)
    .values({
      orgId: dbUser.organization.id,
      userId: dbUser.id,
      propertyAddress: parsed?.propertyAddress ?? file.name,
      propertyCity: parsed?.propertyCity ?? null,
      propertyState: parsed?.propertyState ?? null,
      propertyZip: parsed?.propertyZip ?? null,
      source: 'manual_upload',
      rawPdfUrl: pdfUrl ?? r2Key,
      rawPdfFilename: file.name,
      consumerSpend: consumerSpend as any,
      demographics: demographics as any,
      trafficCounts: parsed?.trafficCounts ?? null,
      housingData: parsed?.housingData ?? null,
      nearbyRetailers: parsed?.nearbyRetailers ?? null,
      parseModel: 'claude-sonnet-4-20250514',
      parseTokensUsed: parsed?.tokensUsed ?? null,
      parseCompletedAt: parseError ? null : new Date(),
      parseError,
    })
    .returning()

  // Ensure org has a grade weights row (upsert defaults)
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
  })
}
