/**
 * Commercial Property Data Parser
 *
 * Extracts structured site analytics from commercial property PDF reports
 * using Claude's vision API. Supports manual PDF uploads (any standard
 * commercial real estate report) and direct API push integrations.
 *
 * The parser returns strongly-typed data matching the DB schema types.
 * All numeric values are in thousands ($000s) as commonly reported —
 * the grading engine normalizes units before scoring.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  PropertyConsumerSpend,
  PropertyDemographic,
  PropertyTrafficCount,
  PropertyHousingData,
  PropertyRetailer,
} from '@/lib/db/schema'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('[property-data-parser] ANTHROPIC_API_KEY is not set')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedPropertyReport {
  propertyAddress: string
  propertyCity: string | null
  propertyState: string | null
  propertyZip: string | null
  consumerSpend: {
    oneMile: PropertyConsumerSpend
    threeMile: PropertyConsumerSpend
    fiveMile: PropertyConsumerSpend
  } | null
  demographics: {
    oneMile: PropertyDemographic
    threeMile: PropertyDemographic
    fiveMile: PropertyDemographic
  } | null
  trafficCounts: PropertyTrafficCount[]
  housingData: PropertyHousingData | null
  nearbyRetailers: PropertyRetailer[]
  tokensUsed: number
}

const SYSTEM_PROMPT = `You are a commercial real estate data extraction specialist.
Extract structured data from commercial property analytics reports with perfect precision.
Return ONLY valid JSON — no markdown, no prose, no code fences.
All dollar figures keep their original units ($000s as reported).
Missing data fields should be null, not omitted.`

const USER_PROMPT = `Extract all available data from this commercial property report PDF into this exact JSON structure:

{
  "propertyAddress": "full street address",
  "propertyCity": "city or null",
  "propertyState": "2-letter state code or null",
  "propertyZip": "zip code or null",
  
  "consumerSpend": {
    "oneMile": {
      "totalSpecified": 0,
      "apparel": 0,
      "entertainmentHobbies": 0,
      "foodAlcohol": 0,
      "household": 0,
      "transportation": 0,
      "healthcare": 0,
      "education": 0
    },
    "threeMile": { "same fields" },
    "fiveMile": { "same fields" }
  },
  
  "demographics": {
    "oneMile": {
      "population2024": 0,
      "populationGrowth5yr": 0.0,
      "medianAge": 0.0,
      "medianHouseholdIncome": 0,
      "avgHouseholdIncome": 0,
      "medianHomeValue": 0,
      "ownerOccupiedPct": 0.0,
      "bachelorsPlusPct": 0.0,
      "age65PlusPct": 0.0,
      "hispanicPct": 0.0
    },
    "threeMile": { "same fields" },
    "fiveMile": { "same fields" }
  },
  
  "trafficCounts": [
    {
      "street": "street name",
      "crossStreet": "cross street name",
      "avgDailyVolume": 0,
      "countYear": 2024,
      "distanceMiles": 0.0
    }
  ],
  
  "housingData": {
    "medianHomeValue": 0,
    "ownerOccupiedPct": 0.0,
    "totalUnits": 0,
    "medianYearBuilt": 0
  },
  
  "nearbyRetailers": [
    {
      "name": "chain name",
      "distanceMiles": 0.0,
      "salesVolumeK": null,
      "grade": null,
      "direction": "N/S/E/W/NE/NW/SE/SW or null",
      "category": "big_box|fast_food|fast_casual|grocery|pharmacy|other"
    }
  ]
}

For "category" in nearbyRetailers, classify as:
- "big_box": Walmart, Target, Costco, Home Depot, Lowe's, Best Buy, etc.
- "fast_food": McDonald's, Burger King, Taco Bell, Wendy's, etc.
- "fast_casual": Chipotle, Panera, Five Guys, etc.
- "grocery": Publix, Kroger, Whole Foods, Trader Joe's, etc.
- "pharmacy": CVS, Walgreens, Rite Aid
- "other": everything else

For populationGrowth5yr use the 5-year forward projection percentage as a decimal (e.g., 15.32% = 15.32).
For ownerOccupiedPct, bachelorsPlusPct, age65PlusPct, hispanicPct use percentage values (e.g., 74.67% = 74.67).
All income/home values in actual dollars (not thousands).
All consumer spend values in thousands ($000s) as reported.`

/**
 * Parse a commercial property analytics PDF from a base64-encoded buffer.
 * The PDF is sent to Claude's vision API which can read multi-page PDFs.
 * Accepts reports from any commercial data provider — the extraction schema
 * is format-agnostic and driven by Claude's understanding of the document.
 */
export async function parsePropertyReportPdf(
  pdfBase64: string,
  filename: string
): Promise<ParsedPropertyReport> {
  const response = await anthropic.beta.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    betas: ['pdfs-2024-09-25'],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          } as any,
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });
  const tokensUsed =
    (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  // Strip any accidental markdown fences
  const jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: Omit<ParsedPropertyReport, 'tokensUsed'>
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(
      `[property-data-parser] Failed to parse Claude response as JSON from "${filename}": ${jsonText.slice(0, 200)}`
    )
  }

  return { ...parsed, tokensUsed }
}

/**
 * Validate and normalize parsed consumer spend data.
 * Returns null for sections missing required fields so the grading engine
 * can gracefully skip unavailable data rather than penalize it.
 */
export function normalizeConsumerSpend(
  raw: Partial<PropertyConsumerSpend> | null | undefined
): PropertyConsumerSpend | null {
  if (!raw || raw.totalSpecified == null) return null
  return {
    totalSpecified: Number(raw.totalSpecified) || 0,
    apparel: Number(raw.apparel) || 0,
    entertainmentHobbies: Number(raw.entertainmentHobbies) || 0,
    foodAlcohol: Number(raw.foodAlcohol) || 0,
    household: Number(raw.household) || 0,
    transportation: Number(raw.transportation) || 0,
    healthcare: Number(raw.healthcare) || 0,
    education: Number(raw.education) || 0,
  }
}

export function normalizeDemographic(
  raw: Partial<PropertyDemographic> | null | undefined
): PropertyDemographic | null {
  if (!raw || raw.population2024 == null) return null
  return {
    population2024: Number(raw.population2024) || 0,
    populationGrowth5yr: Number(raw.populationGrowth5yr) || 0,
    medianAge: Number(raw.medianAge) || 0,
    medianHouseholdIncome: Number(raw.medianHouseholdIncome) || 0,
    avgHouseholdIncome: Number(raw.avgHouseholdIncome) || 0,
    medianHomeValue: Number(raw.medianHomeValue) || 0,
    ownerOccupiedPct: Number(raw.ownerOccupiedPct) || 0,
    bachelorsPlusPct: Number(raw.bachelorsPlusPct) || 0,
    age65PlusPct: Number(raw.age65PlusPct) || 0,
    hispanicPct: Number(raw.hispanicPct) || 0,
  }
}
