import { NextRequest, NextResponse } from 'next/server'
import { logEvent } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { type, metadata } = await req.json()
    if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

    await logEvent(type, metadata || {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics/event]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
