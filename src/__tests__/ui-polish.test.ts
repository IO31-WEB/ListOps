import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isBrandAssetKey, isVersionedBrandKey, brandAssetKeyFromUrl, resolveBrandAssetUrl, withResolvedBrandAssets } from '@/lib/brand-assets'
import { KIT_CATALOG } from '@/lib/visual-kit/catalog'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const UID = '0b8f7e0a-1c2d-4e5f-8a9b-123456789abc'

describe('brand assets', () => {
  test('accepts only keys our upload route generates', () => {
    expect(isBrandAssetKey(`brand-kits/${UID}/logo-a1b2c3d4e5f6.png`)).toBe(true)
    expect(isBrandAssetKey(`brand-kits/${UID}/agentPhoto.jpg`)).toBe(true) // legacy, unversioned
    for (const bad of ['../etc/passwd', `brand-kits/${UID}/../x.png`, `listings/${UID}/a.jpg`, `brand-kits/${UID}/logo.svg`, `brand-kits/${UID}/other-abcdef.png`, `brand-kits/${UID}/logo-abcdef.png/extra`]) {
      expect(isBrandAssetKey(bad), bad).toBe(false)
    }
  })

  test('versioned keys are the cacheable ones', () => {
    expect(isVersionedBrandKey(`brand-kits/${UID}/logo-a1b2c3d4e5f6.png`)).toBe(true)
    expect(isVersionedBrandKey(`brand-kits/${UID}/logo.png`)).toBe(false)
  })

  test('any stored form resolves to the same-origin route', () => {
    const key = `brand-kits/${UID}/logo-a1b2c3d4e5f6.png`
    const want = `/api/brand-assets/${key}`
    expect(resolveBrandAssetUrl(`https://pub-123.r2.dev/${key}`)).toBe(want)
    expect(resolveBrandAssetUrl(`https://assets.listops.io/${key}?x=1`)).toBe(want)
    expect(resolveBrandAssetUrl(want)).toBe(want)
    expect(brandAssetKeyFromUrl(want)).toBe(key)
  })

  test('data URLs and other https pass through; junk and empty do not', () => {
    expect(resolveBrandAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(resolveBrandAssetUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
    expect(resolveBrandAssetUrl('javascript:alert(1)')).toBe('')
    expect(resolveBrandAssetUrl('http://insecure.example/logo.png')).toBe('')
    expect(resolveBrandAssetUrl('')).toBe('')
    expect(resolveBrandAssetUrl(null)).toBe('')
  })

  test('withResolvedBrandAssets only touches image fields', () => {
    const key = `brand-kits/${UID}/logo-a1b2c3d4e5f6.png`
    const out = withResolvedBrandAssets({ logoUrl: `https://x.r2.dev/${key}`, agentName: 'Sam', agentPhotoUrl: '', primaryColor: '#111111' })
    expect(out.logoUrl).toBe(`/api/brand-assets/${key}`)
    expect(out.agentName).toBe('Sam')
    expect(out.agentPhotoUrl).toBe('')
  })

  test('upload route issues versioned keys and returns the same-origin URL', () => {
    const src = read('src/app/api/brand-kit/upload/route.ts')
    expect(src).toMatch(/randomBytes\(6\)/)
    expect(src).toMatch(/brandAssetUrl\(key\)/)
  })
})

describe('visual kit', () => {
  test('no Facebook cover; more Instagram graphics', () => {
    expect(Object.keys(KIT_CATALOG)).not.toContain('fb-cover')
    const ig = Object.keys(KIT_CATALOG).filter(k => k.startsWith('ig-'))
    expect(ig.length).toBeGreaterThanOrEqual(5)
    expect(ig.filter(k => k.startsWith('ig-story')).length).toBeGreaterThanOrEqual(2)
  })

  test('graphics start from different photos', () => {
    const slots = Object.values(KIT_CATALOG).map(k => k.slot)
    expect(new Set(slots).size).toBeGreaterThanOrEqual(5)
  })

  test('Story template keeps its info panel above the agent bar', () => {
    const src = read('src/lib/visual-kit/render.tsx')
    expect(src).toMatch(/photoH = 1100.*barTop = 1590/s)
    expect(src).toMatch(/overflow: 'hidden'.*flexDirection: 'column', padding: '44px 72px 0'/s)
  })
})

describe('notifications', () => {
  test('read state is server-side and old items are not returned', () => {
    const api = read('src/app/api/notifications/route.ts')
    expect(api).toMatch(/notificationsSeenAt/)
    expect(api).toMatch(/NOTIFICATION_MAX_AGE_DAYS = 3/)
    const header = read('src/components/dashboard/header.tsx')
    expect(header).not.toMatch(/listops_notifications_v1['"]\)\s*$/m) // the old cached list is no longer read
    expect(header).toMatch(/notifications\/seen/)
  })
})

describe('brand colors + migration', () => {
  test('migration adds both columns idempotently', () => {
    const sql = read('drizzle/0017_ui_polish.sql')
    expect(sql).toMatch(/extra_colors/)
    expect(sql).toMatch(/notifications_seen_at/)
    expect(sql.match(/IF NOT EXISTS/g)?.length).toBe(2)
  })
  test('API validates extra colors', () => {
    const src = read('src/app/api/brand-kit/route.ts')
    expect(src).toMatch(/extraColors: z\.array\(BrandColorSchema\)\.max\(8\)/)
  })
})

describe('marketing copy', () => {
  test('only "Three" is emphasised', () => {
    expect(read('src/app/page.tsx')).toMatch(/From Listing to Launch in <em>Three<\/em> Steps/)
  })
})
