/**
 * Clerk Webhook — Sync users to our database
 * Handles user.created, user.updated, user.deleted
 * Uses Web Crypto API for verification (no svix package needed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getOrCreateUser } from '@/lib/user-service'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

type ClerkWebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string; id: string }>
    first_name?: string
    last_name?: string
    image_url?: string
    primary_email_address_id?: string
  }
}

async function verifyClerkWebhook(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  try {
    const signedContent = `${svixId}.${svixTimestamp}.${body}`
    const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(signedContent))
    const computedSig = `v1,${Buffer.from(signature).toString('base64')}`
    const signatures = svixSignature.split(' ')
    return signatures.some(sig => sig === computedSig)
  } catch (err) {
    console.error('Webhook verification error:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  const body = await request.text()
  const headersList = await headers()

  if (webhookSecret) {
    const svixId = headersList.get('svix-id')
    const svixTimestamp = headersList.get('svix-timestamp')
    const svixSignature = headersList.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
    }

    const isValid = await verifyClerkWebhook(body, svixId, svixTimestamp, svixSignature, webhookSecret)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  let event: ClerkWebhookEvent
  try {
    event = JSON.parse(body) as ClerkWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, image_url, primary_email_address_id } = event.data
        const primaryEmail = email_addresses.find(e => e.id === primary_email_address_id)?.email_address
          || email_addresses[0]?.email_address

        if (!primaryEmail) break

        await getOrCreateUser(id, {
          email: primaryEmail,
          firstName: first_name,
          lastName: last_name,
          avatarUrl: image_url,
        })
        console.log(`✅ User created: ${id}`)
        break
      }

      case 'user.updated': {
        const { id, first_name, last_name, image_url } = event.data
        const existingUser = await db.query.users.findFirst({ where: eq(users.clerkId, id) })
        if (existingUser) {
          await db.update(users).set({
            firstName: first_name,
            lastName: last_name,
            avatarUrl: image_url,
            updatedAt: new Date(),
          }).where(eq(users.clerkId, id))
        }
        break
      }

      case 'user.deleted': {
        // Soft delete: block access now, purge content after 30 days (see /api/cron/retention).
        // Previously this did nothing, so a deleted Clerk account's data stayed in our database forever.
        const clerkId = event.data.id as string | undefined
        if (clerkId) {
          const closed = await db.update(users).set({ deletedAt: new Date() })
            .where(and(eq(users.clerkId, clerkId), isNull(users.deletedAt)))
            .returning({ id: users.id })
          if (closed[0]) await logAudit({ action: 'user.deleted', actorClerkId: clerkId, targetUserId: closed[0].id })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Clerk webhook error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
