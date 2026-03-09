import { rateLimitGenerate } from '@/lib/ratelimit'

delete (process.env as any).UPSTASH_REDIS_REST_URL
delete (process.env as any).UPSTASH_REDIS_REST_TOKEN

describe('rateLimitGenerate (in-memory)', () => {
  test('allows first request', async () => {
    const result = await rateLimitGenerate(`test-user-${Date.now()}`)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
  })
  test('decrements remaining on each request', async () => {
    const uid = `test-decrement-${Date.now()}`
    await rateLimitGenerate(uid)
    await rateLimitGenerate(uid)
    const result = await rateLimitGenerate(uid)
    expect(result.remaining).toBe(2)
  })
  test('blocks after limit exceeded', async () => {
    const uid = `test-block-${Date.now()}`
    for (let i = 0; i < 5; i++) await rateLimitGenerate(uid)
    const result = await rateLimitGenerate(uid)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })
  test('reset timestamp is in the future', async () => {
    const result = await rateLimitGenerate(`test-reset-${Date.now()}`)
    expect(result.reset).toBeGreaterThan(Date.now())
  })
})
