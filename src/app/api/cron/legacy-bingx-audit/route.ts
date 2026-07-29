import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getLegacyBingxAudit } from '@/lib/bingx'
import { evaluateLegacyBingxHealth } from '@/lib/legacy-bingx-health'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

function parseTimestamp(value: string | null, fallback: number) {
  if (value === null) return fallback
  if (!/^\d{13}$/.test(value)) return null
  const timestamp = Number(value)
  return Number.isSafeInteger(timestamp) ? timestamp : null
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const startTime = parseTimestamp(
    request.nextUrl.searchParams.get('startTime'),
    now - 30 * 24 * 60 * 60 * 1000,
  )
  const endTime = parseTimestamp(request.nextUrl.searchParams.get('endTime'), now)
  if (startTime === null || endTime === null) {
    return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const [audit, openTradeResult, recoveryResult] = await Promise.all([
      getLegacyBingxAudit(startTime, endTime),
      admin
        .from('algotrend_trades')
        .select('id, direction')
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle(),
      admin
        .from('legacy_bingx_executions')
        .select('trade_id, action, status, attempt_count, last_error_code, updated_at')
        .in('status', ['PENDING', 'SUBMITTED', 'FAILED', 'UNKNOWN'])
        .order('updated_at', { ascending: true })
        .limit(20),
    ])
    if (openTradeResult.error) throw openTradeResult.error
    if (recoveryResult.error) throw recoveryResult.error

    const unresolvedExecutions = recoveryResult.data ?? []
    const health = {
      status: evaluateLegacyBingxHealth({
        tradingEnabled: audit.tradingEnabled,
        appTrade: openTradeResult.data,
        positions: audit.positions,
        openOrderCount: audit.openOrders.length,
        unresolvedExecutions,
      }),
      appTrade: openTradeResult.data,
      unresolvedExecutions,
    }

    return NextResponse.json({ ok: true, health, audit }, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    console.error('[legacy bingx audit]', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Legacy BingX audit failed',
    }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, private' },
    })
  }
}
