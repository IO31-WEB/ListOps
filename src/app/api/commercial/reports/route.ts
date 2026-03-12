/**
 * GET /api/commercial/reports          — list org's CoStar reports
 * GET /api/commercial/reports?id=...   — fetch single report + grade
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { costarReports, propertyGrades } from '@/lib/db/schema'
import { getUserWithDetails } from '@/lib/user-service'
import { canAccess } from '@/lib/plans'
import { eq, and, desc, inArray } from 'drizzle-orm'
import type { PlanTier } from '@/lib/plans'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await getUserWithDetails(userId)
  if (!dbUser?.organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Prefer subscription plan (source of truth) — organization.plan can lag behind
  const sub = dbUser.organization.subscriptions?.[0]
  const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
  if (!canAccess(plan, 'costar_integration')) {
    return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
  }

  const reportId = request.nextUrl.searchParams.get('id')

  if (reportId) {
    // Single report with its latest grade
    const report = await db.query.costarReports.findFirst({
      where: and(
        eq(costarReports.id, reportId),
        eq(costarReports.orgId, dbUser.organization.id)
      ),
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const grade = await db.query.propertyGrades.findFirst({
      where: eq(propertyGrades.costarReportId, reportId),
      orderBy: [desc(propertyGrades.createdAt)],
    })

    return NextResponse.json({ report, grade: grade ?? null })
  }

  // List view — return reports with their latest grade summary (no raw data)
  const reports = await db.query.costarReports.findMany({
    where: eq(costarReports.orgId, dbUser.organization.id),
    orderBy: [desc(costarReports.createdAt)],
    limit: 50,
  })

  // Batch fetch latest grades for all reports
  const reportIds = reports.map((r) => r.id)
  const grades =
    reportIds.length > 0
      ? await db.query.propertyGrades.findMany({
          where: inArray(propertyGrades.costarReportId, reportIds),
          orderBy: [desc(propertyGrades.createdAt)],
        })
      : []

  // Map latest grade per report
  const gradeMap = new Map<string, (typeof grades)[0]>()
  for (const g of grades) {
    if (!gradeMap.has(g.costarReportId)) {
      gradeMap.set(g.costarReportId, g)
    }
  }

  const items = reports.map((r) => {
    const g = gradeMap.get(r.id)
    return {
      id: r.id,
      propertyAddress: r.propertyAddress,
      propertyCity: r.propertyCity,
      propertyState: r.propertyState,
      source: r.source,
      rawPdfFilename: r.rawPdfFilename,
      parseError: r.parseError,
      createdAt: r.createdAt,
      grade: g
        ? {
            id: g.id,
            overallGrade: g.overallGrade,
            overallScore: g.overallScore,
            generatedAt: g.generatedAt,
          }
        : null,
    }
  })

  return NextResponse.json({ items })
}
