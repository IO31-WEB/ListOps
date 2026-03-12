/**
 * Property Grading Engine
 *
 * Converts parsed CoStar data into weighted A–F letter grades.
 * Benchmarks are calibrated against national commercial RE averages.
 *
 * Each category produces a 0–100 score. The weighted composite determines
 * the overall grade. Weights are configurable per-org in the grade_weights table.
 *
 * Scoring benchmarks reference the 3-mile trade area as the primary radius —
 * it represents the realistic customer draw for most retail/commercial uses.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  CostarConsumerSpend,
  CostarDemographic,
  CostarTrafficCount,
  CostarRetailer,
  CostarAnchorTenant,
  CostarGradeWeights,
} from '@/lib/db/schema'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Grade thresholds ──────────────────────────────────────────

const GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 97, grade: 'A+' },
  { min: 93, grade: 'A' },
  { min: 90, grade: 'A-' },
  { min: 87, grade: 'B+' },
  { min: 83, grade: 'B' },
  { min: 80, grade: 'B-' },
  { min: 77, grade: 'C+' },
  { min: 73, grade: 'C' },
  { min: 70, grade: 'C-' },
  { min: 67, grade: 'D+' },
  { min: 63, grade: 'D' },
  { min: 60, grade: 'D-' },
  { min: 0,  grade: 'F' },
]

export function scoreToGrade(score: number): string {
  return GRADE_THRESHOLDS.find((t) => score >= t.min)?.grade ?? 'F'
}

// ── Traffic Score ─────────────────────────────────────────────
// Benchmarks: <5k = poor strip/secondary; 20k+ = strong arterial; 45k+ = highway corridor

export function scoreTraffic(counts: CostarTrafficCount[]): number {
  if (!counts.length) return 40 // missing data penalty

  // Use the highest-volume count at the closest location (primary arterial)
  const primary = counts
    .filter((c) => c.distanceMiles <= 0.5)
    .sort((a, b) => b.avgDailyVolume - a.avgDailyVolume)[0]

  const secondary = counts
    .filter((c) => c.distanceMiles <= 1.0)
    .sort((a, b) => b.avgDailyVolume - a.avgDailyVolume)[0]

  const volume = primary?.avgDailyVolume ?? secondary?.avgDailyVolume ?? 0

  if (volume >= 50_000) return 100
  if (volume >= 40_000) return 95
  if (volume >= 30_000) return 88
  if (volume >= 20_000) return 80
  if (volume >= 15_000) return 72
  if (volume >= 10_000) return 63
  if (volume >= 5_000)  return 52
  if (volume >= 2_000)  return 40
  return 25
}

// ── Consumer Spend Score ──────────────────────────────────────
// 3-mile total spend in $000s. National retail median ~$500M; top quartile $1B+

export function scoreConsumerSpend(
  threeMile: CostarConsumerSpend | null | undefined
): number {
  if (!threeMile?.totalSpecified) return 40

  const totalM = threeMile.totalSpecified / 1_000 // convert $000s → $M

  if (totalM >= 1_500) return 100
  if (totalM >= 1_200) return 95
  if (totalM >= 900)   return 88
  if (totalM >= 700)   return 82
  if (totalM >= 500)   return 74
  if (totalM >= 350)   return 66
  if (totalM >= 200)   return 57
  if (totalM >= 100)   return 46
  return 32
}

// ── Household Income Score ─────────────────────────────────────
// 3-mile median HH income. National median ~$70k; affluent markets $100k+

export function scoreHouseholdIncome(
  threeMile: CostarDemographic | null | undefined
): number {
  if (!threeMile?.medianHouseholdIncome) return 40

  const income = threeMile.medianHouseholdIncome

  if (income >= 130_000) return 100
  if (income >= 110_000) return 95
  if (income >= 90_000)  return 88
  if (income >= 80_000)  return 82
  if (income >= 70_000)  return 75
  if (income >= 60_000)  return 66
  if (income >= 50_000)  return 56
  if (income >= 40_000)  return 45
  return 30
}

// ── Demographics Score ────────────────────────────────────────
// Composite: population size, growth trajectory, age profile, education

export function scoreDemographics(
  threeMile: CostarDemographic | null | undefined
): number {
  if (!threeMile) return 40

  let score = 0

  // Population (3mi) — 25 pts
  const pop = threeMile.population2024
  if (pop >= 150_000)     score += 25
  else if (pop >= 100_000) score += 22
  else if (pop >= 75_000)  score += 18
  else if (pop >= 50_000)  score += 14
  else if (pop >= 25_000)  score += 10
  else                     score += 5

  // Growth rate (5yr) — 20 pts
  const growth = threeMile.populationGrowth5yr
  if (growth >= 20)      score += 20
  else if (growth >= 15) score += 17
  else if (growth >= 10) score += 13
  else if (growth >= 5)  score += 8
  else if (growth >= 0)  score += 4
  else                   score += 0  // population decline

  // Education (bachelor's+) — 20 pts
  const edu = threeMile.bachelorsPlusPct
  if (edu >= 50)      score += 20
  else if (edu >= 40) score += 17
  else if (edu >= 30) score += 13
  else if (edu >= 20) score += 8
  else                score += 4

  // Median age suitability — 15 pts (25–55 ideal for most retail)
  const age = threeMile.medianAge
  if (age >= 30 && age <= 55)      score += 15
  else if (age >= 25 && age <= 60) score += 11
  else                              score += 6

  // Avg HH income bonus — 20 pts
  const avgIncome = threeMile.avgHouseholdIncome
  if (avgIncome >= 120_000)     score += 20
  else if (avgIncome >= 90_000)  score += 17
  else if (avgIncome >= 70_000)  score += 13
  else if (avgIncome >= 55_000)  score += 8
  else                           score += 4

  return Math.min(100, score)
}

// ── Anchor Tenant Score ───────────────────────────────────────
// Big-box and high-traffic anchors drive traffic; competitors can be negative

const BIG_BOX_ANCHORS = new Set([
  'walmart', 'target', 'costco', 'sam\'s club', 'bj\'s',
  'home depot', 'lowe\'s', 'menards',
  'best buy', 'dick\'s sporting goods',
  'publix', 'kroger', 'whole foods', 'trader joe\'s', 'aldi',
  'tjx', 'tj maxx', 'marshalls', 'ross', 'burlington',
  'bed bath & beyond', 'five below', 'dollar tree', 'dollar general',
])

const HIGH_VALUE_FAST_CASUAL = new Set([
  'chipotle', 'panera', 'five guys', 'shake shack', 'sweetgreen',
  'chick-fil-a', 'raising cane\'s',
])

export function scoreAnchorTenants(
  retailers: CostarRetailer[]
): { score: number; anchors: CostarAnchorTenant[] } {
  if (!retailers.length) return { score: 50, anchors: [] }

  let score = 50 // baseline
  const anchors: CostarAnchorTenant[] = []

  for (const r of retailers) {
    const nameLower = r.name.toLowerCase()
    const isBigBox = r.category === 'big_box' || BIG_BOX_ANCHORS.has(nameLower)
    const isHighValueFC = HIGH_VALUE_FAST_CASUAL.has(nameLower)
    const isClose = r.distanceMiles <= 0.5
    const isNearby = r.distanceMiles <= 1.0

    let impact: 'positive' | 'neutral' | 'negative' = 'neutral'
    let points = 0

    if (isBigBox && isClose) {
      points = 18
      impact = 'positive'
    } else if (isBigBox && isNearby) {
      points = 12
      impact = 'positive'
    } else if (isBigBox) {
      points = 6
      impact = 'positive'
    } else if (r.category === 'grocery' && isClose) {
      points = 12
      impact = 'positive'
    } else if (r.category === 'grocery' && isNearby) {
      points = 8
      impact = 'positive'
    } else if (isHighValueFC && isClose) {
      points = 8
      impact = 'positive'
    } else if (r.category === 'pharmacy' && isClose) {
      points = 5
      impact = 'positive'
    }

    // Saturation penalty: too many direct fast-food competitors
    if (r.category === 'fast_food' && isClose) {
      points -= 2
      impact = 'negative'
    }

    score = Math.max(0, Math.min(100, score + points))

    if (points !== 0) {
      anchors.push({
        name: r.name,
        distanceMiles: r.distanceMiles,
        category: r.category,
        salesGrade: r.grade,
        impact,
      })
    }
  }

  return { score: Math.min(100, score), anchors }
}

// ── Weighted Composite ────────────────────────────────────────

export function computeOverallScore(
  scores: {
    traffic: number
    consumerSpend: number
    householdIncome: number
    demographics: number
    anchorTenant: number
  },
  weights: CostarGradeWeights
): number {
  return (
    scores.traffic * weights.traffic +
    scores.consumerSpend * weights.consumerSpend +
    scores.householdIncome * weights.householdIncome +
    scores.demographics * weights.demographics +
    scores.anchorTenant * weights.anchorTenant
  )
}

// ── AI Narrative Generation ───────────────────────────────────

export interface GradeNarrative {
  summary: string
  strengths: string[]
  risks: string[]
  recommendation: string
  tokensUsed: number
}

export async function generateGradeNarrative(opts: {
  address: string
  overallGrade: string
  overallScore: number
  trafficScore: number
  consumerSpendScore: number
  householdIncomeScore: number
  demographicsScore: number
  anchorTenantScore: number
  anchors: CostarAnchorTenant[]
  demographics: CostarDemographic | null | undefined
  trafficCounts: CostarTrafficCount[]
}): Promise<GradeNarrative> {
  const topTraffic = opts.trafficCounts
    .sort((a, b) => b.avgDailyVolume - a.avgDailyVolume)
    .slice(0, 2)

  const prompt = `You are a senior commercial real estate analyst. Write a concise site analysis for:

Property: ${opts.address}
Overall Grade: ${opts.overallGrade} (${opts.overallScore.toFixed(1)}/100)

Category Scores:
- Traffic: ${opts.trafficScore.toFixed(1)}/100 — ${topTraffic.map(t => `${t.street} (${t.avgDailyVolume.toLocaleString()} AADT)`).join(', ') || 'No data'}
- Consumer Spend (3mi): ${opts.consumerSpendScore.toFixed(1)}/100
- Household Income: ${opts.householdIncomeScore.toFixed(1)}/100${opts.demographics ? ` — median $${opts.demographics.medianHouseholdIncome.toLocaleString()}` : ''}
- Demographics: ${opts.demographicsScore.toFixed(1)}/100${opts.demographics ? ` — ${opts.demographics.population2024.toLocaleString()} pop, ${opts.demographics.populationGrowth5yr}% 5yr growth, median age ${opts.demographics.medianAge}` : ''}
- Anchor Tenants: ${opts.anchorTenantScore.toFixed(1)}/100 — ${opts.anchors.length ? opts.anchors.map(a => `${a.name} (${a.distanceMiles}mi, ${a.impact})`).join(', ') : 'No major anchors detected'}

Respond in this exact JSON format (no markdown, no prose outside JSON):
{
  "summary": "2-3 sentence executive summary of the site",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "risks": ["risk 1", "risk 2"],
  "recommendation": "1 sentence buy/lease/pass recommendation"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const tokensUsed =
    (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)

  const raw = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(raw)
    return {
      summary: parsed.summary ?? '',
      strengths: parsed.strengths ?? [],
      risks: parsed.risks ?? [],
      recommendation: parsed.recommendation ?? '',
      tokensUsed,
    }
  } catch {
    return {
      summary: `Site graded ${opts.overallGrade} with an overall score of ${opts.overallScore.toFixed(1)}/100.`,
      strengths: [],
      risks: [],
      recommendation: 'Manual review recommended.',
      tokensUsed,
    }
  }
}

// ── Default weights ───────────────────────────────────────────

export const DEFAULT_GRADE_WEIGHTS: CostarGradeWeights = {
  traffic: 0.25,
  consumerSpend: 0.25,
  householdIncome: 0.20,
  demographics: 0.15,
  anchorTenant: 0.15,
}
