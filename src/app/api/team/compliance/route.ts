/**
 * GET/PUT /api/team/compliance — brokerage compliance profile (required disclaimer, licence lines, locked brand fields).
 * Owner/admin of a Brokerage+ org only (getTeamAdminContext); org id comes from the signed-in user, never the request.
 * Locked VALUES are copied from the admin's own Brand Kit at save time, so no extra upload flow is needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { assertSameOrigin } from '@/lib/admin'
import { getTeamAdminContext } from '@/lib/team-data'
import { db } from '@/lib/db'
import { brandKits, orgCompliance } from '@/lib/db/schema'
import { writeAuditLog } from '@/lib/user-service'
import { LOCKABLE_FIELDS, LOCK_LABELS, type LockableField } from '@/lib/compliance/brand'
import { toOrgCompliance } from '@/lib/compliance/load'

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

const Body = z.object({
  requiredDisclaimer: z.preprocess(blankToNull, z.string().trim().max(600).nullable()),
  brokerageLicense: z.preprocess(blankToNull, z.string().trim().max(60).nullable()),
  equalHousing: z.boolean(),
  showAgentLicense: z.boolean(),
  lockFields: z.array(z.enum(LOCKABLE_FIELDS)).max(LOCKABLE_FIELDS.length),
})

async function adminBrand(userDbId: string) {
  const bk = await db.query.brandKits.findFirst({ where: eq(brandKits.userId, userDbId) })
  const vals: Record<LockableField, string> = {
    brokerageName: bk?.brokerageName ?? '', brokerageLogo: bk?.brokerageLogo ?? '', logoUrl: bk?.logoUrl ?? '',
    primaryColor: bk?.primaryColor ?? '', accentColor: bk?.accentColor ?? '', tagline: bk?.tagline ?? '',
    extraColors: Array.isArray(bk?.extraColors) && bk!.extraColors.length ? JSON.stringify(bk!.extraColors) : '',
  }
  return vals
}

export async function GET() {
  try {
    const ctx = await getTeamAdminContext()
    if (!ctx) throw new ApiError(403, 'Compliance profiles are available to Brokerage owners and admins.')
    const [row, own] = await Promise.all([
      db.query.orgCompliance.findFirst({ where: eq(orgCompliance.orgId, ctx.orgId) }),
      adminBrand(ctx.userDbId),
    ])
    return NextResponse.json({ profile: row ? toOrgCompliance(row) : null, ownBrand: own }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return handleApiError(err, { route: 'team/compliance.get' })
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const ctx = await getTeamAdminContext()
    if (!ctx) throw new ApiError(403, 'Compliance profiles are available to Brokerage owners and admins.')
    const body = Body.parse(await readJson(request, 8 * 1024))

    const own = await adminBrand(ctx.userDbId)
    const locked: Partial<Record<LockableField, string>> = {}
    for (const k of new Set(body.lockFields)) {
      if (!own[k].trim()) throw new ApiError(400, `Set "${LOCK_LABELS[k]}" in your own Brand Kit first, then lock it.`)
      locked[k] = own[k]
    }

    const values = {
      requiredDisclaimer: body.requiredDisclaimer, brokerageLicense: body.brokerageLicense,
      equalHousing: body.equalHousing, showAgentLicense: body.showAgentLicense, locked,
      updatedBy: ctx.userDbId, updatedAt: new Date(),
    }
    await db.insert(orgCompliance).values({ orgId: ctx.orgId, ...values }).onConflictDoUpdate({ target: orgCompliance.orgId, set: values })
    await writeAuditLog({
      orgId: ctx.orgId, userId: ctx.userDbId, action: 'compliance_profile.updated', resourceType: 'org_compliance', resourceId: ctx.orgId,
      metadata: { locked: Object.keys(locked), equalHousing: body.equalHousing, hasDisclaimer: !!body.requiredDisclaimer },
    })
    return NextResponse.json({ ok: true, profile: { ...values, locked } })
  } catch (err) {
    return handleApiError(err, { route: 'team/compliance.put' })
  }
}
