import 'server-only'

import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function hashSensitive(value: string | null) {
  if (!value) return null
  const key = process.env.BROKER_AUDIT_HASH_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') return null
    return createHash('sha256').update(value).digest('hex')
  }
  return createHmac('sha256', key).update(value).digest('hex')
}

export function brokerRequestId(request: NextRequest) {
  return request.headers.get('x-request-id')?.slice(0, 100) || randomUUID()
}

export async function writeBrokerAudit(input: {
  request?: NextRequest
  requestId?: string
  userId?: string | null
  actorUserId?: string | null
  connectionId?: string | null
  eventType: string
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED'
  metadata?: Record<string, string | number | boolean | null>
}) {
  const ip = input.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || input.request?.headers.get('x-real-ip')
    || null
  const userAgent = input.request?.headers.get('user-agent') || null
  const admin = createAdminClient()
  const { error } = await admin.from('broker_audit_events').insert({
    user_id: input.userId ?? null,
    actor_user_id: input.actorUserId ?? null,
    connection_id: input.connectionId ?? null,
    event_type: input.eventType,
    outcome: input.outcome,
    request_id: input.requestId ?? (input.request ? brokerRequestId(input.request) : null),
    ip_hash: hashSensitive(ip),
    user_agent_hash: hashSensitive(userAgent),
    metadata: input.metadata ?? {},
  })
  if (error) console.error('[broker-audit] insert failed', error.code)
}
