import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter } from '@/lib/rate-limit'
import { copySupabaseCookies, refreshSession } from '@/lib/supabase/middleware'

const OFFICIAL_HOSTS = new Set(['gonovi.app', 'www.gonovi.app', 'localhost', '127.0.0.1'])

// ── Route classification ──────────────────────────────────────────
const SENSITIVE_ROUTES = ['/api/backfill', '/api/push/send', '/api/debug']
const AUTH_ROUTES = ['/api/dashboard/login']
const DASHBOARD_ROUTES = ['/api/analytics/stats', '/api/dashboard/settings']
const WEBHOOK_ROUTES = ['/api/cron', '/api/webhook']
const ANALYTICS_ROUTES = ['/api/analytics/event', '/api/analytics/track', '/api/links/track']
const SUBSCRIBE_ROUTES = ['/api/push/subscribe']

function getPreset(pathname: string): string {
  if (AUTH_ROUTES.some(r => pathname.startsWith(r))) return 'auth'
  if (SENSITIVE_ROUTES.some(r => pathname.startsWith(r))) return 'sensitive'
  if (DASHBOARD_ROUTES.some(r => pathname.startsWith(r))) return 'sensitive'
  if (WEBHOOK_ROUTES.some(r => pathname.startsWith(r))) return 'webhook'
  if (ANALYTICS_ROUTES.some(r => pathname.startsWith(r))) return 'analytics'
  if (SUBSCRIBE_ROUTES.some(r => pathname.startsWith(r))) return 'subscribe'
  return 'public'
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const rawHost = forwardedHost || req.headers.get('host') || ''
  const host = rawHost.split(':')[0]?.toLowerCase() || ''

  // Public results never need an authenticated server session. Skipping the
  // refresh here keeps the page available when Supabase Auth is degraded and
  // avoids adding an auth round-trip before the trade snapshot can render.
  const supabaseResponse = pathname === '/official/estrategias'
    ? NextResponse.next({ request: req })
    : await refreshSession(req)

  // ── 1. Public GONOVI home rewrite ─────────────────────────────────
  if (
    pathname === '/' &&
    OFFICIAL_HOSTS.has(host)
  ) {
    const url = req.nextUrl.clone()
    url.pathname = '/official'
    return copySupabaseCookies(supabaseResponse, NextResponse.rewrite(url))
  }

  // ── 2. Block debug endpoints in production ────────────────────────
  if (pathname.startsWith('/api/debug') && process.env.NODE_ENV === 'production') {
    return copySupabaseCookies(
      supabaseResponse,
      NextResponse.json({ error: 'Not found' }, { status: 404 })
    )
  }

  // ── 3. Rate limiting by IP ────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'

  const preset = getPreset(pathname)
  const { success, remaining, resetIn } = rateLimiter.check(ip, preset)

  if (!success) {
    return copySupabaseCookies(
      supabaseResponse,
      NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetIn / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    )
  }

  // ── 4. Protect sensitive routes (require admin cookie) ────────────
  if (SENSITIVE_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('algotrend_dash')?.value
    const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim()
    const authHeader = req.headers.get('authorization')?.trim()

    const expectedPassword = process.env.DASHBOARD_PASSWORD?.replace(/\\n/g, '').trim()
    const hasAdminCookie = token && expectedPassword && token === expectedPassword
    const hasCronBearer = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!hasAdminCookie && !hasCronBearer) {
      return copySupabaseCookies(
        supabaseResponse,
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }
  }

  // ── 5. Pass through with rate limit headers ───────────────────────
  const response = supabaseResponse
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: ['/', '/official/:path*', '/cuenta/:path*', '/admin/:path*', '/api/:path*'],
}
