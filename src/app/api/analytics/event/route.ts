import { NextRequest, NextResponse } from 'next/server'
import { logEvent } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const events = Array.isArray(rawBody) ? rawBody : [rawBody]

    for (const body of events) {
      const { type, metadata } = body
      if (typeof type !== 'string' || type.length === 0 || type.length > 64) continue
      const safeMeta = metadata && typeof metadata === 'object' ? metadata : {}
      await logEvent(type, safeMeta as Record<string, unknown>)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics/event]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
