import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim()
  const dashPassword = process.env.DASHBOARD_PASSWORD?.replace(/\\n/g, '').trim()

  const authHeader = req.headers.get('authorization')?.trim()
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  const dashCookie = req.cookies.get('algotrend_dash')?.value
  if (dashPassword && dashCookie === dashPassword) return true

  return false
}

function clampString(input: unknown, max: number): string {
  if (typeof input !== 'string') return ''
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 32) continue
    if (ch === '<' || ch === '>') continue
    out += ch
    if (out.length >= max) break
  }
  return out.trim()
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = await req.json() as { title?: unknown; body?: unknown; tag?: unknown }
    const title = clampString(raw.title, 100)
    const body = clampString(raw.body, 300)
    const tag = clampString(raw.tag, 64)

    if (!title || !body) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }

    const result = await sendPushNotification({ title, body, tag: tag || undefined })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 })
  }
}
