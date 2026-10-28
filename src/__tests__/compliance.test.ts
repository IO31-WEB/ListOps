import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { RULES, applyRewrites, mapStrings, scanFields, scanText } from '@/lib/compliance/fair-housing'
import { applyCompliance, buildDisclaimer, lockedKeys } from '@/lib/compliance/brand'
import { brandWarnings } from '@/lib/compliance/warnings'
import { canAccess } from '@/lib/plans'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ids = (t: string) => scanText(t).map(f => f.ruleId)

describe('Fair Housing scanner', () => {
  test('flags familial-status phrasing and rewrites it', () => {
    expect(ids('Perfect for families in a family-friendly neighborhood.')).toEqual(['perfect-for-family', 'family-friendly'])
    expect(applyRewrites('Perfect for families in a family-friendly neighborhood.').text).toBe('With room to spread out in a welcoming neighborhood.')
  })
  test('master -> primary, preserving case; master-planned untouched', () => {
    expect(applyRewrites('Spacious master bedroom and Master Suite.').text).toBe('Spacious primary bedroom and Primary Suite.')
    expect(ids('A master-planned community')).toEqual([])
  })
  test('flag-only findings are never auto-rewritten', () => {
    const f = scanText('No children allowed')
    expect(f[0].ruleId).toBe('no-children')
    expect(f[0].after).toBeNull()
    expect(applyRewrites('No children allowed').text).toBe('No children allowed')
  })
  test('no false positive on Temple Terrace or plain copy', () => {
    expect(ids('Tucked in Temple Terrace')).toEqual([])
    expect(ids('A bright kitchen with quartz counters.')).toEqual([])
    expect(scanText('')).toEqual([])
  })
  test('steering + source of income + religion', () => {
    expect(ids('No Section 8')).toContain('no-section-8')
    expect(ids('Walk to the church')).toContain('religion-terms')
    expect(applyRewrites('Located in a safe neighborhood near great schools.').text).toBe('Located in a quiet neighborhood near nearby schools.')
  })
  test('rewrite only selected rules', () => {
    expect(applyRewrites('Safe area. Master bath.', ['master-bedroom']).text).toBe('Safe area. Primary bath.')
  })
  test('every rule is well-formed (global+insensitive regex, unique id, rewrite passes its own scan)', () => {
    expect(new Set(RULES.map(r => r.id)).size).toBe(RULES.length)
    for (const r of RULES) {
      expect(r.pattern.flags).toContain('g'); expect(r.pattern.flags).toContain('i')
      if (r.rewrite) expect(r.rewrite).not.toMatch(/famil|church|kids|children/i)
    }
  })
  test('deep field scan reports where the phrase is; mapStrings preserves structure', () => {
    const found = scanFields({ facebookPosts: [{ copy: 'Great for a family' }], emailJustListed: 'Master suite!' })
    expect(found.map(f => f.path)).toEqual(['facebookPosts[0].copy', 'emailJustListed'])
    expect(mapStrings({ a: ['x', { b: 'y' }], n: 3 }, s => s.toUpperCase())).toEqual({ a: ['X', { b: 'Y' }], n: 3 })
  })
})

describe('compliance profile resolver', () => {
  const org = { requiredDisclaimer: 'Reed Realty is licensed.', brokerageLicense: '99', equalHousing: true, showAgentLicense: true, locked: { brokerageName: 'Reed', primaryColor: '#111111' } }
  test('locks override agent values; unlocked fields untouched', () => {
    const eff = applyCompliance({ brokerageName: 'Mine', primaryColor: '#fff', tagline: 't' }, org, '555')
    expect(eff.brokerageName).toBe('Reed'); expect(eff.primaryColor).toBe('#111111'); expect(eff.tagline).toBe('t')
  })
  test('required text comes first, parts are de-duplicated', () => {
    expect(applyCompliance({ disclaimer: 'Equal Housing Opportunity. Info deemed reliable.' }, org, '555').disclaimer)
      .toBe('Reed Realty is licensed. Broker license #99. Agent license #555. Equal Housing Opportunity. Info deemed reliable.')
    expect(buildDisclaimer('Reed Realty is licensed.', { ...org, equalHousing: false, brokerageLicense: null, showAgentLicense: false })).toBe('Reed Realty is licensed.')
  })
  test('works when the agent has no brand kit; no org = unchanged', () => {
    expect(applyCompliance(null, org).brokerageName).toBe('Reed')
    expect(applyCompliance({ tagline: 'x' }, null)).toEqual({ tagline: 'x' })
    expect(lockedKeys(org)).toEqual(['brokerageName', 'primaryColor']); expect(lockedKeys(null)).toEqual([])
  })
})

describe('missing-branding warnings', () => {
  test('empty kit lists every required gap', () => expect(brandWarnings(null).filter(w => w.level === 'required')).toHaveLength(5))
  test('complete kit has none', () => {
    expect(brandWarnings({ agentName: 'A', brokerageName: 'B', agentPhone: '1', logoUrl: 'x', agentPhotoUrl: 'y', disclaimer: 'Equal Housing Opportunity' }, { licenseNumber: '1' })).toEqual([])
  })
  test('disclaimer without Equal Housing is a recommendation', () => {
    expect(brandWarnings({ agentName: 'A', brokerageName: 'B', agentPhone: '1', logoUrl: 'x', agentPhotoUrl: 'y', disclaimer: 'Info deemed reliable.' }, { licenseNumber: '1' }).map(w => w.id)).toEqual(['equalHousing'])
  })
})

describe('wiring', () => {
  test('gates', () => {
    expect(canAccess('free', 'fair_housing_scan')).toBe(true)
    expect(canAccess('pro', 'compliance_profile')).toBe(false)
    expect(canAccess('brokerage', 'compliance_profile')).toBe(true)
  })
  test('every output path applies the effective (compliance-resolved) brand kit', () => {
    for (const p of ['src/app/flyer/[id]/page.tsx', 'src/lib/visual-kit/data.ts', 'src/app/l/[slug]/page.tsx', 'src/app/api/generate/route.ts']) expect(read(p), p).toContain('loadEffectiveBrandKit(')
  })
  test('loader only applies the profile for plans that include it', () => {
    expect(read('src/lib/compliance/load.ts')).toContain("canAccess(plan, 'compliance_profile')")
  })
  test('brand-kit API drops locked fields server-side', () => {
    const s = read('src/app/api/brand-kit/route.ts')
    expect(s).toContain('lockedKeys(org)'); expect(s).toContain('delete rest[k]')
  })
  test('compliance admin API: owner/admin only, same-origin, audited', () => {
    const s = read('src/app/api/team/compliance/route.ts')
    for (const n of ['getTeamAdminContext()', 'assertSameOrigin(', 'writeAuditLog(']) expect(s).toContain(n)
  })
  test('campaign scan route is owner-scoped, same-origin on write, rate limited', () => {
    const s = read('src/app/api/campaigns/[id]/compliance/route.ts')
    for (const n of ['requireUserId()', 'getCampaign(', 'assertSameOrigin(', 'rateLimitCompliance(']) expect(s).toContain(n)
  })
  test('generation prompts carry the Fair Housing rules', () => {
    // The shared standards() block carries the rules for all three residential prompts; regenerate carries them in rules().
    const gen = read('src/app/api/generate/route.ts')
    expect(gen).toMatch(/\$\{FAIR_HOUSING_PROMPT_RULES\}/)
    for (const fn of ['buildSocialPrompt', 'buildListingContentPrompt', 'buildProPrompt']) {
      const body = gen.slice(gen.indexOf(`function ${fn}`), gen.indexOf('\n}\n', gen.indexOf(`function ${fn}`)))
      expect(body, fn).toContain('${standards(f)}')
    }
    expect(read('src/app/api/campaigns/[id]/regenerate/route.ts')).toMatch(/\$\{FAIR_HOUSING_PROMPT_RULES\}/)
  })
  test('privacy policy discloses microsite lead data', () => {
    const s = read('src/app/privacy/page.tsx')
    for (const n of ['Listing Microsite Visitors', 'Twilio', 'salted hash']) expect(s).toContain(n)
  })
})
