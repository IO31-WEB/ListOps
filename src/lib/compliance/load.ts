import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orgCompliance, users } from '@/lib/db/schema'
import { canAccess, type PlanTier } from '@/lib/plans'
import { resolvePlan } from '@/lib/plan-resolve'
import { applyCompliance, type OrgCompliance } from './brand'
import { withResolvedBrandAssets } from '@/lib/brand-assets'

export function toOrgCompliance(row: typeof orgCompliance.$inferSelect): OrgCompliance {
  return {
    requiredDisclaimer: row.requiredDisclaimer, brokerageLicense: row.brokerageLicense,
    equalHousing: row.equalHousing, showAgentLicense: row.showAgentLicense, locked: row.locked ?? {},
  }
}

/** The org's compliance profile for an agent — null unless the agent's org is on a plan that includes it. */
export async function loadComplianceForAgent(agentUserId: string): Promise<{ org: OrgCompliance | null; licenseNumber: string | null }> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, agentUserId),
    columns: { orgId: true, licenseNumber: true, role: true },
    with: { organization: { with: { subscriptions: true } } },
  })
  if (!u?.orgId) return { org: null, licenseNumber: u?.licenseNumber ?? null }
  const plan = resolvePlan(u)
  if (!canAccess(plan, 'compliance_profile')) return { org: null, licenseNumber: u.licenseNumber }
  const row = await db.query.orgCompliance.findFirst({ where: eq(orgCompliance.orgId, u.orgId) })
  return { org: row ? toOrgCompliance(row) : null, licenseNumber: u.licenseNumber }
}

/** Brand kit as it must appear on outputs (flyers, graphics, microsite, generation). Unchanged when no org profile applies. */
export async function loadEffectiveBrandKit<T extends Record<string, any>>(bk: T | null | undefined, agentUserId: string): Promise<T | null> {
  const { org, licenseNumber } = await loadComplianceForAgent(agentUserId)
  const effective = org ? applyCompliance(bk, org, licenseNumber) : (bk ?? null)
  // Logos/headshot are addressed by key through /api/brand-assets (no dependency on public bucket access).
  return effective ? withResolvedBrandAssets(effective) : null
}
