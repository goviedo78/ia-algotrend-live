import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runBrokerKeyKeepalive } from '@/lib/brokers/keepalive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Same secret as the broker job drain: both are called by pg_cron.
function authorized(request: NextRequest) {
  const expected = process.env.BROKER_DRAIN_SECRET?.replace(/\\n/g, '').trim()
  const provided = request.headers.get('x-broker-drain-secret')?.replace(/\\n/g, '').trim()
  if (!expected || !provided) return false
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.byteLength === providedBytes.byteLength
    && timingSafeEqual(expectedBytes, providedBytes)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runBrokerKeyKeepalive()
  return NextResponse.json({ ok: result.failed === 0, ...result }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
