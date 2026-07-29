import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processBrokerJobsInApp } from '@/lib/brokers/worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  const result = await processBrokerJobsInApp({
    batchSize: 50,
    maxBatches: 20,
    concurrency: 20,
    timeBudgetMs: 25_000,
  })
  return NextResponse.json({ ok: true, ...result }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
