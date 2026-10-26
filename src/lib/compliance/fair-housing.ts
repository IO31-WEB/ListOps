/**
 * Fair Housing language scanner — rule-based, deterministic, no AI call, safe to run in the browser.
 *
 * It flags phrases that commonly draw Fair Housing complaints (familial status, religion, race / national origin, sex,
 * disability, source of income, steering) and offers a neutral rewrite where a mechanical one is safe.
 * It is a safety net, NOT legal advice and NOT exhaustive: it can miss things and can flag harmless text.
 * Rewrites change what a property is described as; they never name or imply who should live there.
 */

export type FhCategory = 'familial status' | 'religion' | 'race / national origin' | 'sex' | 'disability' | 'source of income' | 'age / marital status' | 'steering' | 'industry practice'
export type FhSeverity = 'high' | 'medium' | 'low'

interface Rule {
  id: string
  category: FhCategory
  severity: FhSeverity
  pattern: RegExp          // must be global + case-insensitive
  message: string
  /** Replacement text (supports $1). null = flag only; a person must decide. */
  rewrite: string | null
}

const R = (id: string, category: FhCategory, severity: FhSeverity, pattern: RegExp, message: string, rewrite: string | null): Rule =>
  ({ id, category, severity, pattern, message, rewrite })

export const RULES: Rule[] = [
  // ── familial status ──
  R('family-friendly', 'familial status', 'medium', /\bfamily[- ]friendly\b/gi, 'Describing a home or area as "family-friendly" can signal a preference for families with children.', 'welcoming'),
  R('perfect-for-family', 'familial status', 'medium', /\b(?:perfect|ideal|great|ideally suited|well[- ]suited)\s+(?:for|to)\s+(?:a\s+|the\s+)?(?:young\s+|growing\s+|large\s+)?famil(?:y|ies)\b/gi, 'Naming who the home is "perfect for" can steer by familial status. Describe the home instead.', 'with room to spread out'),
  R('no-children', 'familial status', 'high', /\b(?:no|not suitable for|not for)\s+(?:kids|children|child|minors|babies|toddlers)\b|\bchild[- ]free\b|\badults?[- ]only\b/gi, 'Excluding children is prohibited unless the property is lawfully qualified senior (55+/62+) housing.', null),
  R('adult-community', 'familial status', 'medium', /\badult\s+(?:community|living|complex)\b/gi, 'Only lawfully qualified 55+/62+ communities may market this way. State the actual age-qualification instead.', null),
  R('ideal-for-group', 'age / marital status', 'medium', /\b(?:perfect|ideal|great)\s+for\s+(?:a\s+)?(?:young\s+|single\s+|married\s+|retired\s+)?(?:couples?|newlyweds?|singles?|professionals?|bachelors?|bachelorettes?|retirees?|empty[- ]nesters?|seniors?|students?)\b/gi, 'Naming an ideal buyer (age, marital status, life stage) can imply a preference. Describe the home.', 'a comfortable, flexible home'),
  R('age-people', 'age / marital status', 'low', /\b(?:young|older|mature|elderly)\s+(?:couples?|professionals?|adults?|people|buyers?|owners?)\b/gi, 'Age references about residents or buyers can be discriminatory in many states.', null),
  // ── religion ──
  R('religion-terms', 'religion', 'medium', /\b(?:churches|church|synagogues?|mosques?|cathedral|christian|catholic|jewish|muslim|mormon|lds)\b|\btemple\b(?!\s+terrace)/gi, 'Referencing a religion or a place of worship can imply a religious preference. Describe amenities by distance without naming the religion.', null),
  // ── race / color / national origin ──
  R('demographic-area', 'race / national origin', 'high', /\b(?:white|black|asian|hispanic|latino|latina|ethnic|caucasian|oriental|foreign)\s+(?:neighborhood|community|area|buyers?|families|section)\b/gi, 'Describing an area or buyer by race, color or national origin is prohibited.', null),
  R('english-only', 'race / national origin', 'high', /\b(?:native[- ]english|english[- ]speaking\s+(?:only|neighborhood|community|buyers?)|must speak english)\b/gi, 'Language requirements can be national-origin discrimination.', null),
  R('exclusive-area', 'race / national origin', 'low', /\b(?:exclusive|restricted)\s+(neighborhood|community|area|enclave)\b/gi, '"Exclusive" or "restricted" area language has a history as coded exclusion. Describe concrete features.', 'sought-after $1'),
  // ── steering ──
  R('safe-area', 'steering', 'medium', /\bsafe\s+(neighborhood|area|community|street|streets|location)\b/gi, 'Safety claims about an area can steer. Describe features (gated entry, lighting) or leave it out.', 'quiet $1'),
  R('good-schools', 'steering', 'medium', /\b(?:in\s+(?:a|the)\s+)?(?:top|highly[- ]rated|great|good|best|excellent|award[- ]winning)\s+school\s+district\b/gi, 'School-quality claims can steer. Name the district neutrally and point buyers to official ratings.', 'in a local school district'),
  R('good-schools-2', 'steering', 'medium', /\b(?:top|highly[- ]rated|great|good|best|excellent)[- ](?:rated\s+)?schools?\b/gi, 'School-quality claims can steer. Say "near schools" and point buyers to official ratings.', 'nearby schools'),
  // ── source of income ──
  R('no-section-8', 'source of income', 'high', /\bno\s+(?:section\s*8|vouchers?|hud|housing assistance|welfare)\b|\bnot\s+accept(?:ing)?\s+(?:section\s*8|vouchers?)\b/gi, 'Refusing vouchers / lawful income sources is illegal in many states and cities.', null),
  // ── disability ──
  R('handicap-accessible', 'disability', 'low', /\bhandicap(?:ped)?[- ](?:accessible|friendly|equipped)\b/gi, 'Use "accessible" rather than "handicapped".', 'accessible'),
  R('disability-exclusion', 'disability', 'high', /\b(?:able[- ]bodied|no\s+(?:disabled|wheelchairs?|handicap(?:ped)?)|not\s+suitable\s+for\s+(?:the\s+)?(?:disabled|handicapped|wheelchair)|must\s+be\s+able\s+to\s+(?:walk|climb|live independently)|wheelchair[- ]bound|confined\s+to\s+a\s+wheelchair|crippled|invalid)\b/gi, 'Language that excludes or labels people with disabilities is prohibited.', null),
  R('walking-distance', 'disability', 'low', /\bwalking\s+distance\s+(?:to|from|of)\b/gi, 'Some Fair Housing guides advise stating distance (e.g. "0.3 miles to") instead of assuming ability to walk.', 'close to'),
  // ── sex ──
  R('sex-exclusion', 'sex', 'high', /\b(?:females?|males?|women|men|ladies|gentlemen)\s+only\b|\bno\s+(?:single\s+)?(?:women|men|females?|males?)\b/gi, 'Sex-based restrictions are prohibited.', null),
  R('sex-stereotype', 'sex', 'low', /\b(?:man[- ]cave|she[- ]shed|bachelor(?:ette)?\s+pad)\b/gi, 'Gendered terms can read as a preference. Use a neutral description.', 'bonus space'),
  // ── industry practice ──
  R('master-bedroom', 'industry practice', 'low', /\bmaster\s+(bed(?:room)?|suite|bath(?:room)?|closet|retreat)\b/gi, 'Many MLSs and brokerages now require "primary" instead of "master".', 'primary $1'),
]

export interface FhFinding {
  ruleId: string
  category: FhCategory
  severity: FhSeverity
  match: string
  start: number
  end: number
  message: string
  rewrite: string | null
  /** What the matched text would become, when a rewrite exists. */
  after: string | null
}

const SEVERITY_RANK: Record<FhSeverity, number> = { high: 0, medium: 1, low: 2 }

function applyCase(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) && /^[a-z]/.test(replacement) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
}

function expand(rule: Rule, m: RegExpExecArray): string | null {
  if (rule.rewrite === null) return null
  const out = rule.rewrite.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '')
  return applyCase(m[0], out)
}

/** All findings in `text`, in reading order. Overlapping matches keep the more severe one. */
export function scanText(text: string): FhFinding[] {
  if (!text) return []
  const raw: FhFinding[] = []
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      raw.push({ ruleId: rule.id, category: rule.category, severity: rule.severity, match: m[0], start: m.index, end: m.index + m[0].length, message: rule.message, rewrite: rule.rewrite, after: expand(rule, m) })
    }
  }
  raw.sort((a, b) => a.start - b.start || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.end - a.end)
  const kept: FhFinding[] = []
  for (const f of raw) {
    const last = kept[kept.length - 1]
    if (last && f.start < last.end) {
      // overlap: keep the more severe, else the longer
      if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[last.severity] || (f.severity === last.severity && f.end - f.start > last.end - last.start)) kept[kept.length - 1] = f
      continue
    }
    kept.push(f)
  }
  return kept
}

/** Applies mechanical rewrites (optionally only for some rule ids). Flag-only findings are left untouched. */
export function applyRewrites(text: string, onlyRuleIds?: readonly string[]): { text: string; applied: FhFinding[] } {
  const findings = scanText(text).filter(f => f.after !== null && (!onlyRuleIds || onlyRuleIds.includes(f.ruleId)))
  let out = text
  for (const f of [...findings].reverse()) out = out.slice(0, f.start) + f.after + out.slice(f.end)
  return { text: out, applied: findings }
}

/** Deep-maps every string inside arrays/objects (pure; returns new structure). */
export function mapStrings<T>(value: T, fn: (s: string, path: string) => string, path = ''): T {
  if (typeof value === 'string') return fn(value, path) as unknown as T
  if (Array.isArray(value)) return value.map((v, i) => mapStrings(v, fn, `${path}[${i}]`)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn, path ? `${path}.${k}` : k)
    return out as T
  }
  return value
}

export interface LocatedFinding extends FhFinding { section: string; path: string; context: string }

/** Scans every string in a named set of fields. `section` is the top-level field name (for friendly grouping). */
export function scanFields(fields: Record<string, unknown>): LocatedFinding[] {
  const out: LocatedFinding[] = []
  for (const [section, value] of Object.entries(fields)) {
    mapStrings(value, (s, p) => {
      for (const f of scanText(s)) {
        const a = Math.max(0, f.start - 40), b = Math.min(s.length, f.end + 40)
        out.push({ ...f, section, path: p ? `${section}${p.startsWith('[') ? '' : '.'}${p}` : section, context: `${a > 0 ? '…' : ''}${s.slice(a, b).replace(/\s+/g, ' ')}${b < s.length ? '…' : ''}` })
      }
      return s
    })
  }
  return out
}

/** Prompt block added to every generation prompt so the model avoids these patterns in the first place. */
export const FAIR_HOUSING_PROMPT_RULES = `FAIR HOUSING (mandatory): Describe the PROPERTY and its features, never the people who should live there. Do not mention or imply race, color, religion, national origin, sex, disability, familial status, age, marital status or source of income. Never write phrases like "perfect for families", "family-friendly", "great for young professionals/couples/retirees", "walking distance to church", "safe neighborhood", "good schools", "master bedroom" (write "primary bedroom"), "man cave", or "exclusive neighborhood". Describe schools, safety and places of worship only by neutral facts the agent supplied, never by quality or who they suit.`
