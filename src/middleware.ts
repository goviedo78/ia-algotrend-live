import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter } from '@/lib/rate-limit'

// ── Route classification ──────────────────────────────────────────
const SENSITIVE_ROUTES = ['/api/backfill', '/api/push/send', '/api/debug']
const AUTH_ROUTES = ['/api/dashboard/login']
const DASHBOARD_ROUTES = ['/api/analytics/stats', '/api/dashboard/settings']
const WEBHOOK_ROUTES = ['/api/cron', '/api/webhook']
const ANALYTICS_ROUTES = ['/api/analytics/event', '/api/analytics/track']
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Block debug endpoints in production ──────────────────────
  if (pathname.startsWith('/api/debug') && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 2. Rate limiting by IP ──────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'

  const preset = getPreset(pathname)
  const { success, remaining, resetIn } = rateLimiter.check(ip, preset)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  // ── 3. Protect sensitive routes (require admin cookie) ──────────
  if (SENSITIVE_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('algotrend_dash')?.value
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    // Allow if admin cookie is valid OR if Bearer token matches cron secret
    const hasAdminCookie = token && token === process.env.DASHBOARD_PASSWORD
    const hasCronBearer = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!hasAdminCookie && !hasCronBearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── 4. Pass through with rate limit headers ─────────────────────
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
