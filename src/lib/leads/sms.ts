/** Optional SMS alert to the AGENT'S OWN number via Twilio REST. Inactive until all three env vars are set. */
export const smsConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) return false
  const sid = process.env.TWILIO_ACCOUNT_SID!
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
    })
    if (!res.ok) console.error('[sms] Twilio responded', res.status)
    return res.ok
  } catch (err) {
    console.error('[sms] send failed', err)
    return false
  }
}
