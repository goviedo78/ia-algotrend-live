import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'push_subscriptions'
const SCOPE = 'algotrend'

// Subscribe: store the push subscription in Supabase
// Existing table has columns: id, endpoint, p256dh, auth, scope, created_at
export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json()
    const endpoint = subscription.endpoint
    const p256dh = subscription.keys?.p256dh || ''
    const auth = subscription.keys?.auth || ''

    // Upsert by endpoint + scope
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { endpoint, p256dh, auth, scope: SCOPE, tenant_id: 'algotrend' },
        { onConflict: 'endpoint' }
      )

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Unsubscribe
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    await supabase.from(TABLE).delete().eq('endpoint', endpoint).eq('scope', SCOPE)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
