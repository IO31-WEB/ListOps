/**
 * Rate Limiter Tests
 * Tests the in-memory fallback (no Redis required)
 */
import { rateLimitGenerate } from '@/lib/ratelimit'

// Force in-memory mode for tests
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN

describe('rateLimitGenerate (in-memory)', () => {
  const userId = `test-user-${Date.now()}`

  test('allows first request', async () => {
    const result = await rateLimitGenerate(userId)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
  })

  test('decrements remaining on each request', async () => {
    const uid = `test-user-decrement-${Date.now()}`
    await rateLimitGenerate(uid) // 1
    await rateLimitGenerate(uid) // 2
    const result = await rateLimitGenerate(uid) // 3
    expect(result.remaining).toBe(2)
  })

  test('blocks after limit exceeded', async () => {
    const uid = `test-user-block-${Date.now()}`
    for (let i = 0; i < 5; i++) await rateLimitGenerate(uid)
    const result = await rateLimitGenerate(uid) // 6th request
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  test('returns reset timestamp in the future', async () => {
    const uid = `test-user-reset-${Date.now()}`
    const result = await rateLimitGenerate(uid)
    expect(result.reset).toBeGreaterThan(Date.now())
  })
})
