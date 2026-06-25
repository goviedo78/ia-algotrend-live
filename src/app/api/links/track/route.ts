import { type NextRequest, NextResponse, after } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function clampStr(val: unknown, max: number): string | null {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  // Sanea control chars y limita longitud
  return trimmed.replace(/[\x00-\x1F\x7F]/g, '').substring(0, max) || null
}

function clampUuid(val: unknown): string | null {
  if (typeof val !== 'string') return null
  return UUID_RE.test(val) ? val : null
}

function clampInt(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null
  const n = Math.floor(val)
  return n >= 0 && n < 1000 ? n : null
}

interface TrackPayload {
  event?: 'view' | 'click'
  sessionId?: string
  referrer?: string
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
  link?: {
    title?: string
    href?: string
    index?: number
  }
}

export async function POST(request: NextRequest) {
  let body: TrackPayload
  try {
    body = (await request.json()) as TrackPayload
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const event = body.event === 'click' ? 'click' : body.event === 'view' ? 'view' : null
  if (!event) return new NextResponse(null, { status: 204 })

  const headersList = await headers()

  // Bot filter mínimo: descarta crawlers obvios
  const uaRaw = headersList.get('user-agent') ?? ''
  if (/bot|crawl|spider|preview|monitor|lighthouse|headless/i.test(uaRaw)) {
    return new NextResponse(null, { status: 204 })
  }

  const ip =
    headersList.get('x-vercel-forwarded-for') ??
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
    null

  const safeDecode = (val: string | null) => {
    if (!val) return null
    try {
      return decodeURIComponent(val)
    } catch {
      return val
    }
  }

  const country = safeDecode(headersList.get('x-vercel-ip-country'))
  const city = safeDecode(headersList.get('x-vercel-ip-city'))
  const region = safeDecode(headersList.get('x-vercel-ip-region'))
  const latitude = headersList.get('x-vercel-ip-latitude') ?? null
  const longitude = headersList.get('x-vercel-ip-longitude') ?? null
  const userAgent = uaRaw.substring(0, 500) || null
  const acceptLanguage = headersList.get('accept-language') ?? ''
  const browserLanguage = acceptLanguage.split(',')[0].trim().substring(0, 50) || null

  // Hash IP (mismo patrón que NFC)
  let ipHash: string | null = null
  if (ip) {
    const salt = process.env.NFC_HASH_SALT
    if (salt) {
      ipHash = crypto.createHash('sha256').update(ip + salt).digest('hex')
    } else {
      // Sin salt: hash igual pero sin proteccion real. Loguear warning una vez.
      console.warn('[links/track] NFC_HASH_SALT no definido; usando salt vacío.')
      ipHash = crypto.createHash('sha256').update(ip).digest('hex')
    }
  }

  const sessionId = clampUuid(body.sessionId)
  const referer = clampStr(body.referrer, 500)
  const utmSource = clampStr(body.utm?.source, 100)
  const utmMedium = clampStr(body.utm?.medium, 100)
  const utmCampaign = clampStr(body.utm?.campaign, 100)
  const utmContent = clampStr(body.utm?.content, 100)
  const utmTerm = clampStr(body.utm?.term, 100)

  // Insert no bloqueante: respondemos al cliente y escribimos en background.
  after(async () => {
    try {
      const supabase = createAdminClient()
      if (event === 'view') {
        await supabase.from('link_views').insert({
          session_id: sessionId,
          ip_hash: ipHash,
          user_agent: userAgent,
          country,
          city,
          region,
          latitude,
          longitude,
          browser_language: browserLanguage,
          referer,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
        })
      } else {
        await supabase.from('link_clicks').insert({
          session_id: sessionId,
          link_index: clampInt(body.link?.index),
          link_title: clampStr(body.link?.title, 120),
          link_href: clampStr(body.link?.href, 500),
          ip_hash: ipHash,
          user_agent: userAgent,
          country,
          city,
          region,
          latitude,
          longitude,
          browser_language: browserLanguage,
          referer,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
        })
      }
    } catch (err) {
      console.error('[links/track] insert failed', err)
    }
  })

  return new NextResponse(null, { status: 204 })
}
