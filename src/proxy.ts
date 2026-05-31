import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter } from '@/lib/rate-limit'
import { copySupabaseCookies, refreshSession } from '@/lib/supabase/middleware'

// ── Maintenance / Coming-Soon gate ────────────────────────────────
const BYPASS_COOKIE = '__gonovi_dev'
const BYPASS_TOKEN = process.env.BYPASS_TOKEN // Sin default para máxima seguridad

const OFFICIAL_HOSTS = new Set(['gonovi.app', 'www.gonovi.app', 'localhost', '127.0.0.1'])
const PUBLIC_GONOVI_HOSTS = new Set(['gonovi.app', 'www.gonovi.app'])

function isMaintenancePath(pathname: string): boolean {
  // Bloqueamos /official y la raíz en cualquier host si estamos en mantenimiento
  if (pathname.startsWith('/official')) return true
  if (pathname === '/') return true 
  return false
}

function maintenanceResponse(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GONOVI · Próximamente</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;background:#0d1122}
body{
  min-height:100%;display:flex;flex-direction:column;align-items:center;
  justify-content:center;
  background:
    radial-gradient(ellipse 80% 55% at 18% 18%,rgba(244,78,28,.11) 0%,transparent 55%),
    radial-gradient(ellipse 55% 45% at 85% 82%,rgba(244,78,28,.07) 0%,transparent 45%),
    linear-gradient(158deg,#1c223a 0%,#11162a 42%,#0d1122 100%);
  font-family:'Space Grotesk',system-ui,sans-serif;
  color:#f0ece4;overflow:hidden;position:relative
}
body::before{
  content:'';position:fixed;inset:0;
  background-image:radial-gradient(circle,rgba(240,236,228,.032) 1px,transparent 1px);
  background-size:28px 28px;pointer-events:none
}
.wrap{
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;text-align:center;
  padding:40px 24px;
  animation:rise .9s cubic-bezier(.16,1,.3,1) both
}
@keyframes rise{
  from{opacity:0;transform:translateY(22px)}
  to{opacity:1;transform:translateY(0)}
}
.mark{
  position:relative;width:160px;height:160px;margin-bottom:42px;
  display:flex;align-items:center;justify-content:center;
  animation:markIn 1.1s cubic-bezier(.16,1,.3,1) .08s both
}
@keyframes markIn{
  from{opacity:0;transform:scale(.7) translateY(8px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
.mark-aura{
  position:absolute;inset:-28%;border-radius:50%;
  background:
    radial-gradient(circle at 50% 50%,rgba(244,78,28,.38) 0%,rgba(244,78,28,.14) 30%,transparent 64%),
    conic-gradient(from 220deg,transparent 0deg,rgba(244,78,28,.22) 70deg,transparent 150deg,transparent 220deg,rgba(244,78,28,.16) 290deg,transparent 360deg);
  filter:blur(6px);
  animation:auraSpin 18s linear infinite
}
@keyframes auraSpin{to{transform:rotate(360deg)}}
.mark-breath{
  position:absolute;inset:0;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,rgba(244,78,28,.22) 0%,transparent 65%);
  animation:breath 5s ease-in-out infinite alternate
}
@keyframes breath{
  from{opacity:.55;transform:scale(.9)}
  to{opacity:1;transform:scale(1.08)}
}
.mark-logo{
  position:relative;width:108px;height:108px;
  filter:
    brightness(0) invert(1)
    drop-shadow(0 0 14px rgba(244,78,28,.55))
    drop-shadow(0 0 28px rgba(244,78,28,.25))
    drop-shadow(0 2px 6px rgba(0,0,0,.45));
  animation:logoFloat 6.5s ease-in-out infinite
}
@keyframes logoFloat{
  0%,100%{transform:translateY(0) rotate(0)}
  50%{transform:translateY(-4px) rotate(.4deg)}
}
.eyebrow{
  display:flex;align-items:center;gap:9px;margin-bottom:20px;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .14s both
}
.dot{
  width:7px;height:7px;border-radius:50%;background:#f44e1c;flex-shrink:0;
  animation:blink 2.5s ease-in-out infinite
}
@keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}
.eyebrow-text{font-size:10.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#f44e1c}
h1{
  font-size:clamp(3.2rem,10vw,6.8rem);font-weight:700;
  letter-spacing:-.028em;line-height:.92;
  background:linear-gradient(158deg,#f0ece4 25%,rgba(240,236,228,.38));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  margin-bottom:8px;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .2s both
}
.sub{
  font-size:clamp(.9rem,2.5vw,1.1rem);font-weight:300;letter-spacing:.02em;
  color:rgba(240,236,228,.32);margin-bottom:38px;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .26s both
}
.rule{
  width:48px;height:1px;
  background:linear-gradient(90deg,transparent,rgba(244,78,28,.55),transparent);
  margin:0 auto 36px;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .3s both
}
.desc{
  font-size:14.5px;line-height:1.7;color:rgba(240,236,228,.46);
  max-width:340px;margin-bottom:46px;font-weight:400;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .34s both
}
.badge{
  display:inline-flex;align-items:center;gap:10px;
  padding:12px 24px;border:1px solid rgba(244,78,28,.2);border-radius:100px;
  background:rgba(244,78,28,.055);color:rgba(240,236,228,.58);
  font-size:13px;font-weight:500;text-decoration:none;letter-spacing:.015em;
  transition:border-color .22s,background .22s,color .22s;
  animation:rise .9s cubic-bezier(.16,1,.3,1) .4s both
}
.badge:hover{border-color:rgba(244,78,28,.5);background:rgba(244,78,28,.11);color:#f0ece4}
.live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0}
footer{
  position:fixed;bottom:20px;left:0;right:0;text-align:center;
  font-size:10.5px;letter-spacing:.1em;color:rgba(240,236,228,.15)
}
</style>
</head>
<body>
<div class="wrap">
  <div class="mark" aria-hidden="true">
    <div class="mark-aura"></div>
    <div class="mark-breath"></div>
    <img class="mark-logo" src="/logo-gon-mark-3d.svg" alt="">
  </div>
  <div class="eyebrow">
    <div class="dot"></div>
    <span class="eyebrow-text">GONOVI &middot; Hub personal</span>
  </div>
  <h1>Próximamente</h1>
  <p class="sub">Nueva experiencia en camino</p>
  <div class="rule"></div>
  <p class="desc">El hub personal de GONOVI está siendo preparado con cuidado. Los productos del ecosistema siguen activos sin interrupciones.</p>
  <a class="badge" href="https://oro15.gonovi.app" target="_blank" rel="noreferrer">
    <span class="live-dot" aria-label="En línea"></span>
    Oro 15M en vivo &middot; oro15.gonovi.app
  </a>
</div>
<footer>GONOVI &copy; 2026</footer>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  })
}

// ── Route classification ──────────────────────────────────────────
// SENSITIVE_ROUTES: require admin cookie (algotrend_dash) o Bearer CRON_SECRET.
// /api/signal entró acá porque inserta/cierra trades, dispara BingX, push y Telegram.
// Sin gate cualquier POST anónimo podría manipular el bot. El Dashboard.tsx que lo
// llama desde el browser sigue funcionando porque el visitante admin lleva la cookie.
const SENSITIVE_ROUTES = ['/api/backfill', '/api/push/send', '/api/debug', '/api/signal']
const AUTH_ROUTES = ['/api/dashboard/login']
const DASHBOARD_ROUTES = ['/api/analytics/stats', '/api/dashboard/settings']
const WEBHOOK_ROUTES = ['/api/cron', '/api/webhook']
// /api/links/track entró acá para usar el preset analytics (120/min) en vez del
// default public (60/min). Es un endpoint de tracking público igual que los otros.
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

  // ── 0. Maintenance gate (non-API page routes) ─────────────────────
  if (isMaintenancePath(pathname) && OFFICIAL_HOSTS.has(host)) {
    const devParam = req.nextUrl.searchParams.get('dev')

    // Grant bypass: set cookie and redirect to the clean URL
    if (devParam && BYPASS_TOKEN && devParam === BYPASS_TOKEN) {
      const url = req.nextUrl.clone()
      url.searchParams.delete('dev')
      const res = NextResponse.redirect(url)
      res.cookies.set(BYPASS_COOKIE, BYPASS_TOKEN, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
      return res
    }

    // Block if no valid bypass cookie (public gonovi.app hosts only — localhost stays open for dev)
    const cookie = req.cookies.get(BYPASS_COOKIE)?.value
    const hasValidBypass = BYPASS_TOKEN && cookie === BYPASS_TOKEN
    if (!hasValidBypass && PUBLIC_GONOVI_HOSTS.has(host)) {
      return maintenanceResponse()
    }
  }

  const supabaseResponse = await refreshSession(req)

  // ── 1. Official home rewrite ──────────────────────────────────────
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
  matcher: ['/', '/official/:path*', '/api/:path*'],
}
