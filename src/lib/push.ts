import { createClient } from '@supabase/supabase-js'
import { logEvent } from '@/lib/analytics'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'push_subscriptions'
const TENANT_ID = 'algotrend'
const SCOPE = 'customer'

export type PushPayload = {
  title: string
  body: string
  tag?: string
}

export async function sendPushNotification(payload: PushPayload) {
  const { data: subs, error } = await supabase
    .from(TABLE)
    .select('endpoint, p256dh, auth')
    .eq('tenant_id', TENANT_ID)
    .eq('scope', SCOPE)

  if (error) {
    await logEvent('push_fail', { title: payload.title, error: error.message })
    throw new Error(error.message)
  }

  if (!subs || subs.length === 0) {
    await logEvent('push_sent', { title: payload.title, sent: 0, failed: 0, total: 0 })
    return { ok: true, sent: 0, failed: 0, total: 0 }
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const vapidSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@algotrend.app'

  if (!vapidPublicKey || !vapidPrivateKey) {
    await logEvent('push_fail', { title: payload.title, error: 'VAPID keys not configured', total: subs.length })
    return { ok: false, error: 'VAPID keys not configured', sent: 0, failed: subs.length, total: subs.length }
  }

  let webpush: typeof import('web-push') | null = null
  try {
    webpush = await import('web-push')
  } catch (err) {
    await logEvent('push_fail', { title: payload.title, error: 'web-push not installed', total: subs.length })
    throw err
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const body = JSON.stringify({ ...payload, tag: payload.tag || 'signal' })
  let sent = 0

  for (const row of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body
      )
      sent++
    } catch (err: unknown) {
      const pushErr = err as { statusCode?: number }
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        await supabase.from(TABLE).delete().eq('endpoint', row.endpoint).eq('scope', SCOPE)
      }
    }
  }

  const failed = subs.length - sent
  await logEvent('push_sent', { title: payload.title, sent, failed, total: subs.length })
  return { ok: true, sent, failed, total: subs.length }
}
