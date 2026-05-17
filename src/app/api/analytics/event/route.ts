import { NextRequest, NextResponse } from 'next/server'
import { logEvent } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const events = Array.isArray(rawBody) ? rawBody : [rawBody]

    for (const body of events) {
      const { type, metadata } = body
      if (!type) continue // Skip invalid events in batch
      await logEvent(type, metadata || {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics/event]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
