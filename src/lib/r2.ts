/**
 * Cloudflare R2 Storage Client
 * S3-compatible API for file uploads (PDFs, images)
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, NEXT_PUBLIC_R2_PUBLIC_URL
 */

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const BUCKET = process.env.R2_BUCKET_NAME ?? 'campaignai-assets'
const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

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
    const { AwsClient } = await import('aws4fetch')
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

export function getR2Url(key: string) {
  return `${PUBLIC_URL}/${key}`
}
