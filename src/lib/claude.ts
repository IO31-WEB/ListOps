import type Anthropic from '@anthropic-ai/sdk'

/**
 * Model used by the commercial routes (teaser, comps, microsite, email-campaign, OM builder).
 * Override without a code change by setting COMMERCIAL_MODEL in Vercel.
 */
export const COMMERCIAL_MODEL = process.env.COMMERCIAL_MODEL || 'claude-opus-5-5'

/**
 * Safely pull the text out of a Claude response.
 * Never assume content[0] is text — newer models may return a 'thinking' block first.
 * Joins every text block and logs block types / stop_reason if nothing usable came back.
 */
export function getText(msg: Anthropic.Message, label = 'claude'): string {
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
  if (!text) {
    console.error(
      `[${label}] no text returned. stop_reason=${msg.stop_reason} blocks=${msg.content.map(b => b.type).join(',')}`
    )
  }
  if (msg.stop_reason === 'max_tokens') {
    console.error(`[${label}] response hit max_tokens and may be truncated`)
  }
  return text
}
