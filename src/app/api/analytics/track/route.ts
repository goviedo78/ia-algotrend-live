import { NextRequest, NextResponse } from 'next/server'
import { logPageview } from '@/lib/analytics'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const path = body.path || '/'
    const referrer = body.referrer || null

    // Country from Vercel's geo header (free in production)
    const country = req.headers.get('x-vercel-ip-country') || null

    // Device detection from user-agent
    const ua = req.headers.get('user-agent') || ''
    const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'

    // Anonymous visitor hash (IP + UA, no PII stored)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const visitorId = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 16)

    await logPageview({ path, referrer: referrer || undefined, country: country || undefined, device, visitorId })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics/track]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
