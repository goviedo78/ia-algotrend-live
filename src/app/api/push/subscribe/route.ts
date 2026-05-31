import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLE = 'push_subscriptions'
const SCOPE = 'customer'

// Defensa anti-CSRF: solo aceptamos requests del mismo origen del host pedido.
// Si un atacante hace fetch desde evil.com a gonovi.app/api/push/subscribe,
// el browser envía Origin: https://evil.com mientras Host: gonovi.app, así
// que el chequeo falla. Si no hay Origin (caso no-browser, ej curl interno),
// permitimos por compatibilidad. Auditoría 30-may.
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const originHost = new URL(origin).hostname.toLowerCase()
    const requestHost = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
    return !!requestHost && originHost === requestHost
  } catch {
    return false
  }
}

// Endpoint de push debe ser URL https válida del provider (FCM, APNs, Mozilla).
function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false
  if (endpoint.length < 20 || endpoint.length > 2000) return false
  return /^https:\/\/[\w.-]+\//.test(endpoint)
}

// Subscribe: store the push subscription in Supabase
// Existing table has columns: id, endpoint, p256dh, auth, scope, created_at
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const subscription = await req.json()
    const endpoint = subscription.endpoint
    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }
    const p256dh = String(subscription.keys?.p256dh || '').substring(0, 200)
    const auth = String(subscription.keys?.auth || '').substring(0, 200)

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
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { endpoint } = await req.json()
    if (!isValidEndpoint(endpoint)) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }
    await supabase.from(TABLE).delete().eq('endpoint', endpoint).eq('scope', SCOPE)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
