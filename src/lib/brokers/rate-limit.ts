import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrokerPlatformError } from './errors'

type LimitName = 'connection_write' | 'admin_write' | 'signal_ingest' | 'connection_read'

const limits: Record<LimitName, { count: number; window: `${number} ${'s' | 'm' | 'h'}` }> = {
  connection_write: { count: 8, window: '10 m' },
  admin_write: { count: 20, window: '10 m' },
  signal_ingest: { count: 120, window: '1 m' },
  connection_read: { count: 60, window: '1 m' },
}

const localHits = new Map<string, number[]>()
const instances = new Map<LimitName, Ratelimit>()

function getDistributedLimiter(name: LimitName) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  let limiter = instances.get(name)
  if (!limiter) {
    const limit = limits[name]
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit.count, limit.window),
      prefix: `gonovi:broker:${name}`,
      analytics: false,
    })
    instances.set(name, limiter)
  }
  return limiter
}

function localLimit(name: LimitName, identifier: string) {
  const now = Date.now()
  const windowMs = name === 'connection_write' || name === 'admin_write' ? 600_000 : 60_000
  const key = `${name}:${identifier}`
  const recent = (localHits.get(key) ?? []).filter((hit) => now - hit < windowMs)
  if (recent.length >= limits[name].count) return false
  recent.push(now)
  localHits.set(key, recent)
  return true
}

function privateIdentifier(name: LimitName, identifier: string) {
  const key = process.env.BROKER_AUDIT_HASH_KEY
  const hash = key
    ? createHmac('sha256', key).update(identifier).digest('hex')
    : createHash('sha256').update(identifier).digest('hex')
  return `${name}:${hash}`
}

async function databaseLimit(name: LimitName, identifier: string) {
  const limit = limits[name]
  const windowSeconds = name === 'connection_write' || name === 'admin_write' ? 600 : 60
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_broker_rate_limit', {
    p_bucket_key: privateIdentifier(name, identifier),
    p_window_seconds: windowSeconds,
    p_max_hits: limit.count,
  })
  if (error || typeof data !== 'boolean') {
    throw new BrokerPlatformError('RATE_LIMIT_UNAVAILABLE', 'La protección de solicitudes no está disponible.', 503)
  }
  return data
}

export function requestIdentifier(request: NextRequest, userId?: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return userId || forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function enforceBrokerRateLimit(name: LimitName, identifier: string) {
  const privateId = privateIdentifier(name, identifier)
  const limiter = getDistributedLimiter(name)
  if (limiter) {
    const result = await limiter.limit(privateId)
    if (!result.success) throw new BrokerPlatformError('RATE_LIMITED', 'Demasiadas solicitudes. Intentá nuevamente más tarde.', 429)
    return
  }

  if (process.env.NODE_ENV === 'production') {
    if (!await databaseLimit(name, identifier)) {
      throw new BrokerPlatformError('RATE_LIMITED', 'Demasiadas solicitudes. Intentá nuevamente más tarde.', 429)
    }
    return
  }
  if (!localLimit(name, identifier)) {
    throw new BrokerPlatformError('RATE_LIMITED', 'Demasiadas solicitudes. Intentá nuevamente más tarde.', 429)
  }
}
