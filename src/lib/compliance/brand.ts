/**
 * Brokerage compliance, pure logic (no DB). The server loader in ./load.ts feeds it.
 *  - locked fields: the org's value replaces whatever the agent saved
 *  - disclaimer: required text first (so clipping never drops it), then licence lines, the agent's own text,
 *    then the Equal Housing line — each part only once even if the agent already typed it
 */

export const LOCKABLE_FIELDS = ['brokerageName', 'brokerageLogo', 'logoUrl', 'primaryColor', 'accentColor', 'tagline'] as const
export type LockableField = (typeof LOCKABLE_FIELDS)[number]

export const LOCK_LABELS: Record<LockableField, string> = {
  brokerageName: 'Brokerage name', brokerageLogo: 'Brokerage logo', logoUrl: 'Agent/team logo',
  primaryColor: 'Primary color', accentColor: 'Accent color', tagline: 'Tagline',
}

export const EQUAL_HOUSING_LINE = 'Equal Housing Opportunity.'

export interface OrgCompliance {
  requiredDisclaimer: string | null
  brokerageLicense: string | null
  equalHousing: boolean
  showAgentLicense: boolean
  locked: Partial<Record<LockableField, string>>
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim()

export function buildDisclaimer(agentDisclaimer: string | null | undefined, org: OrgCompliance, agentLicense?: string | null): string {
  const parts: string[] = []
  const add = (t: string | null | undefined) => {
    const text = (t ?? '').replace(/\s+/g, ' ').trim()
    if (!text) return
    const have = norm(parts.join(' '))
    if (have.includes(norm(text))) return
    parts.push(text)
  }
  add(org.requiredDisclaimer)
  if (org.brokerageLicense?.trim()) add(`Broker license #${org.brokerageLicense.trim()}.`)
  if (org.showAgentLicense && agentLicense?.trim()) add(`Agent license #${agentLicense.trim()}.`)
  add(agentDisclaimer)
  if (org.equalHousing && !/equal housing/i.test(parts.join(' '))) add(EQUAL_HOUSING_LINE)
  return parts.join(' ')
}

/** Returns the brand kit with org locks + forced disclaimer applied. Works with a missing kit (agent never set one up). */
export function applyCompliance<T extends Record<string, any>>(bk: T | null | undefined, org: OrgCompliance | null, agentLicense?: string | null): T {
  const base = (bk ?? {}) as T
  if (!org) return base
  const out: Record<string, any> = { ...base }
  for (const k of LOCKABLE_FIELDS) {
    const v = org.locked[k]
    if (typeof v === 'string' && v.trim()) out[k] = v
  }
  out.disclaimer = buildDisclaimer(base.disclaimer, org, agentLicense)
  return out as T
}

/** Which fields the agent can NOT change (for the Brand Kit page). */
export const lockedKeys = (org: OrgCompliance | null): LockableField[] =>
  org ? LOCKABLE_FIELDS.filter(k => typeof org.locked[k] === 'string' && org.locked[k]!.trim() !== '') : []
