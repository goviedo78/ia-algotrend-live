import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PROBE_TIMEOUT_MS, runDbWatchdog, supabaseProjectRef } from '@/lib/db-watchdog'
import { sendTelegramAlert } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
// La ventana de confirmación dura 4 min; el resto es margen para el reinicio y el aviso.
export const maxDuration = 300

const MANAGEMENT_API = 'https://api.supabase.com/v1/projects'

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.replace(/\\n/g, '').trim()
  const authorization = request.headers.get('authorization')?.trim()
  const provided = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!expected || !provided) return false

  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.byteLength === providedBytes.byteLength
    && timingSafeEqual(expectedBytes, providedBytes)
}

async function fetchWithDeadline(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const ref = supabaseProjectRef(supabaseUrl)
  if (!supabaseUrl || !serviceKey || !accessToken || !ref) {
    return NextResponse.json({ ok: false, error: 'WATCHDOG_NOT_CONFIGURED' }, { status: 500 })
  }
  const management = { Authorization: `Bearer ${accessToken}` }

  const outcome = await runDbWatchdog({
    // Una consulta real contra una tabla, no el endpoint raíz: PostgREST puede contestar su
    // esquema en caché con la base colgada.
    probe: async () => {
      try {
        const response = await fetchWithDeadline(
          `${supabaseUrl}/rest/v1/algotrend_trades?select=id&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
          PROBE_TIMEOUT_MS,
        )
        return response.ok
      } catch {
        return false
      }
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    projectStatus: async () => {
      const response = await fetchWithDeadline(`${MANAGEMENT_API}/${ref}`, { headers: management }, 15_000)
      if (!response.ok) throw new Error(`Management API ${response.status}`)
      const project = await response.json() as { status?: string }
      return project.status ?? 'UNKNOWN'
    },
    restart: async () => {
      const response = await fetchWithDeadline(`${MANAGEMENT_API}/${ref}/restart`, { method: 'POST', headers: management }, 30_000)
      if (!response.ok) throw new Error(`Management API ${response.status}`)
    },
    alert: sendTelegramAlert,
  })

  console.log('[db-watchdog]', outcome)
  // Siempre 200: el resultado va en el cuerpo, y un 5xx haría que cron-job.org apague el job.
  return NextResponse.json({ ok: true, ...outcome })
}
