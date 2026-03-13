export async function POST_COMPS(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dbUser = await getUserWithDetails(userId)
    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    const sub = dbUser.organization.subscriptions?.[0]
    const plan = ((sub?.plan ?? dbUser.organization.plan) ?? 'free') as PlanTier
    if (!canAccess(plan, 'site_analysis')) {
      return NextResponse.json({ error: 'Commercial plan required' }, { status: 403 })
    }

    const { reportId, compAddresses } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const [report] = await db
      .select()
      .from(siteReports)
      .where(and(eq(siteReports.id, reportId), eq(siteReports.userId, dbUser.id)))
      .limit(1)

    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const [grade] = await db
      .select()
      .from(propertyGrades)
      .where(eq(propertyGrades.siteReportId, reportId))
      .limit(1)

    if (!grade) return NextResponse.json({ error: 'Grade this report first' }, { status: 400 })

    const compList = Array.isArray(compAddresses) && compAddresses.length > 0
      ? compAddresses.filter((a: string) => a.trim())
      : []

    const context = buildContext(report, grade)

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `You are a commercial real estate analyst generating a market comparables summary.

SUBJECT PROPERTY DATA:
${context}

${compList.length > 0
  ? `USER-PROVIDED COMP ADDRESSES:\n${compList.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\nFor user-provided comps: use your knowledge of typical commercial transactions in that area/market to estimate reasonable sale prices, $/SF, and cap rates. Mark these as "Estimated" if not verified.`
  : 'No comp addresses provided. Generate 3 representative comparable transactions from your knowledge of the market/trade area indicated by the subject property location and demographics.'
}

Output ONLY valid JSON (no markdown), matching this exact shape:
{
  "summary": "...",
  "comps": [
    {
      "address": "...",
      "salePrice": "...",
      "pricePerSF": "...",
      "capRate": "...",
      "date": "...",
      "notes": "..."
    }
  ],
  "positioning": "...",
  "recommendation": "..."
}

Rules:
- summary: 2–3 sentence market overview characterizing $/SF trends and cap rate ranges in this trade area
- comps: 3–5 entries. Use null for unknown fields (not "N/A"). If estimated, add "(Est.)" to the value.
- positioning: 1–2 sentences comparing the subject property to the comps using the grade data
- recommendation: 1–2 sentences with a specific pricing/positioning recommendation based on grade vs comps`,
      }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const compsData = JSON.parse(clean)

    return NextResponse.json(compsData)
  } catch (err) {
    console.error('[comps]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildContext(report: Record<string, unknown>, grade: Record<string, unknown>): string {
  const lines = [
    `Property: ${report.propertyAddress}${report.propertyCity ? `, ${report.propertyCity}` : ''}${report.propertyState ? `, ${report.propertyState}` : ''}${report.propertyZip ? ` ${report.propertyZip}` : ''}`,
    `Overall Grade: ${grade.overallGrade} (score: ${grade.overallScore}/100)`,
  ]

  const demo = report.demographics as Record<string, unknown> | null
  const d = demo?.threeMile as Record<string, number> | null
  if (d) {
    lines.push(`Population (3mi): ${d.population2024?.toLocaleString()}`)
    lines.push(`Median HH Income: $${d.medianHouseholdIncome?.toLocaleString()}`)
    lines.push(`Avg HH Income: $${d.avgHouseholdIncome?.toLocaleString()}`)
  }

  const traffic = report.trafficCounts as Array<{ street: string; avgDailyVolume: number }> | null
  if (traffic?.length) {
    const top = traffic.reduce((a, b) => a.avgDailyVolume > b.avgDailyVolume ? a : b)
    lines.push(`Peak Traffic: ${top.avgDailyVolume.toLocaleString()} ADT`)
  }

  return lines.join('\n')
}
