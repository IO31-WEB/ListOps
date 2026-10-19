/** Minimal Upstash REST client. Returns null on any failure (callers decide fail-open/closed). */
export async function redisPipeline(commands: Array<Array<string | number>>): Promise<Array<{ result?: unknown }> | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    return (await res.json()) as Array<{ result?: unknown }>
  } catch {
    return null
  }
}
