import { NextRequest, NextResponse } from 'next/server'
import { logEvent, logPageview } from '@/lib/analytics'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const events = Array.isArray(rawBody) ? rawBody : [rawBody]

    // Country from Vercel's geo header (free in production)
    const country = req.headers.get('x-vercel-ip-country') || null

    // Device detection from user-agent
    const ua = req.headers.get('user-agent') || ''
    const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'

    // Anonymous visitor hash (IP + UA, no PII stored)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const visitorId = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 16)

    const trunc = (v: unknown, n: number) => typeof v === 'string' ? v.slice(0, n) : null

    for (const body of events) {
      const path = trunc(body.path, 256) || '/'
      const referrer = trunc(body.referrer, 512)
      const eventType = trunc(body.event_type, 64)

      if (eventType && eventType !== 'pageview') {
        await logEvent(eventType, {
          card_id: trunc(body.card_id, 64),
          card_title: trunc(body.card_title, 128),
          path,
          device,
          country,
        })
      } else {
        await logPageview({ path, referrer: referrer || undefined, country: country || undefined, device, visitorId })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics/track]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
