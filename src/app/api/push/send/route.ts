import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'push_subscriptions'
const SCOPE = 'algotrend'

// Send push to all AlgoTrend subscribers
export async function POST(req: NextRequest) {
  try {
    const { title, body, tag } = await req.json() as { title: string; body: string; tag?: string }

    const { data: subs } = await supabase
      .from(TABLE)
      .select('endpoint, p256dh, auth')
      .eq('scope', SCOPE)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@algotrend.app'

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ ok: false, error: 'VAPID keys not configured', sent: 0 })
    }

    let webpush: typeof import('web-push') | null = null
    try {
      webpush = await import('web-push')
    } catch {
      return NextResponse.json({ ok: false, error: 'web-push not installed', sent: 0 })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const payload = JSON.stringify({ title, body, tag: tag || 'signal' })
    let sent = 0

    for (const row of subs) {
      try {
        const sub = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        }
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number }
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await supabase.from(TABLE).delete().eq('endpoint', row.endpoint).eq('scope', SCOPE)
        }
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
