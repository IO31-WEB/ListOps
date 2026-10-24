/**
 * Cloudflare R2 Storage Client
 * S3-compatible API for file uploads (PDFs, images)
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, NEXT_PUBLIC_R2_PUBLIC_URL
 */

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const BUCKET = process.env.R2_BUCKET_NAME ?? 'listops-assets'
// Trailing slashes are stripped so a value like "https://assets.listops.io/" can't produce "//" URLs.
const PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')

function isConfigured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  )
}

/**
 * Upload a buffer to R2, return the public URL.
 * Falls back gracefully if R2 is not configured.
 */
export async function uploadToR2(opts: {
  key: string
  body: Buffer | Uint8Array
  contentType: string
}): Promise<string | null> {
  if (!isConfigured()) {
    console.warn('[r2] R2 not configured — skipping upload')
    return null
  }

  try {
    // Use AWS Signature V4 via native fetch (no SDK needed)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AwsClient } = (() => { try { return require('aws4fetch') } catch { return { AwsClient: null } } })()
    if (!AwsClient) { console.warn('[r2] aws4fetch not installed'); return null }
    const client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    })

    const url = `${R2_ENDPOINT}/${BUCKET}/${opts.key}`
    const res = await client.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': opts.contentType },
      body: opts.body,
    })

    if (!res.ok) {
      console.error('[r2] Upload failed:', res.status, await res.text())
      return null
    }

    return `${PUBLIC_URL}/${opts.key}`
  } catch (err) {
    console.error('[r2] Upload error:', err)
    return null
  }
}

/** Delete an object from R2. Returns true if it is gone (404 counts as gone). Never throws. */
export async function deleteFromR2(key: string): Promise<boolean> {
  if (!isConfigured()) return false
  try {
    const { AwsClient } = (() => { try { return require('aws4fetch') } catch { return { AwsClient: null } } })()
    if (!AwsClient) return false
    const client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    })
    const res = await client.fetch(`${R2_ENDPOINT}/${BUCKET}/${key}`, { method: 'DELETE' })
    return res.ok || res.status === 404
  } catch (err) {
    console.error('[r2] Delete error:', err)
    return false
  }
}

/**
 * Direct public-bucket URL. Used ONLY for brand-kit assets (logos/headshots).
 * Listing photos go through lib/photos.ts (same-origin /api/photos/...), which does not depend on
 * the bucket being public.
 */
export function getR2Url(key: string) {
  return `${PUBLIC_URL}/${key}`
}

/**
 * Read an object straight from R2 with our credentials (S3 API) — works whether or not the bucket
 * has public access enabled. Returns null when missing/unconfigured. Never throws.
 */
export async function getFromR2(key: string): Promise<{ body: ArrayBuffer; contentType: string | null } | null> {
  if (!isConfigured()) return null
  try {
    const { AwsClient } = (() => { try { return require('aws4fetch') } catch { return { AwsClient: null } } })()
    if (!AwsClient) return null
    const client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    })
    const res = await client.fetch(`${R2_ENDPOINT}/${BUCKET}/${key}`, { method: 'GET', signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      if (res.status !== 404) console.error('[r2] Get failed:', res.status)
      return null
    }
    return { body: await res.arrayBuffer(), contentType: res.headers.get('content-type') }
  } catch (err) {
    console.error('[r2] Get error:', err)
    return null
  }
}
