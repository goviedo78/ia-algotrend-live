import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { loadBrokerAdapter } from './adapter-loader'
import type { BrokerAdapter } from './adapters/types'
import { BingxAdapter } from './adapters/bingx'

// Brokers such as BingX delete API keys that have no bound IP and go unused
// for 14 consecutive days. A daily signed read-only call (balance) counts as
// usage and keeps every stored key alive. Nothing here places orders or
// changes connection status.

// Keys in these states are gone or will never be used again.
const SKIPPED_STATUSES = ['DELETED', 'REVOKED', 'REJECTED']

export type KeepaliveOutcome = {
  target: string
  broker: string
  ok: boolean
  errorCode: string | null
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code: unknown }).code)
  return error instanceof Error ? error.name : 'UNKNOWN'
}

export async function pingAdapter(adapter: Pick<BrokerAdapter, 'getBalance'>) {
  await adapter.getBalance()
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function pingConnections(): Promise<KeepaliveOutcome[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('broker_connections')
    .select('id, broker, status, broker_credential_envelopes!inner(connection_id)')
    .not('status', 'in', `(${SKIPPED_STATUSES.join(',')})`)
  if (error) throw error

  return mapWithConcurrency(data ?? [], 4, async (connection) => {
    try {
      const { adapter } = await loadBrokerAdapter(String(connection.id))
      await pingAdapter(adapter)
      await admin
        .from('broker_connections')
        .update({ last_health_check_at: new Date().toISOString() })
        .eq('id', connection.id)
      return { target: `connection:${connection.id}`, broker: String(connection.broker), ok: true, errorCode: null }
    } catch (err) {
      const code = errorCode(err)
      console.error('[broker-keepalive] connection ping failed', { connectionId: connection.id, code })
      return { target: `connection:${connection.id}`, broker: String(connection.broker), ok: false, errorCode: code }
    }
  })
}

// Direct (legacy) BingX key configured through env vars.
async function pingLegacyBingxKey(): Promise<KeepaliveOutcome | null> {
  const apiKey = process.env.BINGX_API_KEY?.trim()
  const secretKey = process.env.BINGX_SECRET_KEY?.trim()
  if (!apiKey || !secretKey) return null
  try {
    await pingAdapter(new BingxAdapter({
      credentials: { apiKey, secretKey },
      environment: process.env.BINGX_USE_DEMO?.trim() === 'false' ? 'LIVE' : 'DEMO',
    }))
    return { target: 'env:BINGX_API_KEY', broker: 'BINGX', ok: true, errorCode: null }
  } catch (err) {
    const code = errorCode(err)
    console.error('[broker-keepalive] legacy BingX ping failed', { code })
    return { target: 'env:BINGX_API_KEY', broker: 'BINGX', ok: false, errorCode: code }
  }
}

export async function runBrokerKeyKeepalive() {
  const [connections, legacy] = await Promise.all([pingConnections(), pingLegacyBingxKey()])
  const results = legacy ? [...connections, legacy] : connections
  return {
    total: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  }
}
