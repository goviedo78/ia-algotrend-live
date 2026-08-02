import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createAdminClient } from '@/lib/supabase/admin'

type OtpLimitScope =
  | 'global'
  | 'ip'
  | 'email'
  | 'verification_global'
  | 'verification_ip'
  | 'verification_email'

export type OtpLimitDefinition = {
  scope: OtpLimitScope
  identifier: string
  maxRequests: number
  windowSeconds: number
}

export type OtpLimitDecision = {
  success: boolean
  retryAfterSeconds: number
}

export type OtpLimitConsumer = (limit: OtpLimitDefinition) => Promise<OtpLimitDecision>

type LocalBucket = {
  hits: number
  resetAt: number
}

const localBuckets = new Map<string, LocalBucket>()
const upstashLimiters = new Map<string, Ratelimit>()

export class OtpRateLimitError extends Error {
  constructor(
    readonly code: 'RATE_LIMITED' | 'RATE_LIMIT_UNAVAILABLE',
    readonly retryAfterSeconds?: number,
  ) {
    super(code)
    this.name = 'OtpRateLimitError'
  }
}

export function normalizeOtpEmail(email: string): string {
  return email.trim().normalize('NFKC').toLowerCase()
}

function secondsUntilWindowReset(windowSeconds: number, now = Date.now()): number {
  const windowMs = windowSeconds * 1000
  return Math.max(1, Math.ceil((windowMs - (now % windowMs)) / 1000))
}

function privateIdentifier(scope: OtpLimitScope, identifier: string): string {
  const secret = process.env.AUTH_RATE_LIMIT_HASH_KEY || process.env.BROKER_AUDIT_HASH_KEY
  const digest = secret
    ? createHmac('sha256', secret).update(identifier).digest('hex')
    : createHash('sha256').update(identifier).digest('hex')
  return `auth_otp_${scope}:${digest}`
}

function getUpstashLimiter(limit: OtpLimitDefinition): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const key = `${limit.scope}:${limit.maxRequests}:${limit.windowSeconds}`
  let limiter = upstashLimiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(limit.maxRequests, `${limit.windowSeconds} s`),
      prefix: `gonovi:auth:otp:${limit.scope}`,
      analytics: false,
    })
    upstashLimiters.set(key, limiter)
  }
  return limiter
}

function consumeLocalLimit(limit: OtpLimitDefinition): OtpLimitDecision {
  const now = Date.now()
  const key = privateIdentifier(limit.scope, limit.identifier)
  const current = localBuckets.get(key)

  if (!current || current.resetAt <= now) {
    localBuckets.set(key, {
      hits: 1,
      resetAt: now + limit.windowSeconds * 1000,
    })
    return { success: true, retryAfterSeconds: limit.windowSeconds }
  }

  current.hits += 1
  return {
    success: current.hits <= limit.maxRequests,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  }
}

async function consumeAuthLimit(limit: OtpLimitDefinition): Promise<OtpLimitDecision> {
  const identifier = privateIdentifier(limit.scope, limit.identifier)
  const upstash = getUpstashLimiter(limit)

  if (upstash) {
    const result = await upstash.limit(identifier)
    return {
      success: result.success,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return consumeLocalLimit(limit)
  }

  const { data, error } = await createAdminClient().rpc('consume_broker_rate_limit', {
    p_bucket_key: identifier,
    p_window_seconds: limit.windowSeconds,
    p_max_hits: limit.maxRequests,
  })

  if (error || typeof data !== 'boolean') {
    throw new OtpRateLimitError('RATE_LIMIT_UNAVAILABLE')
  }

  return {
    success: data,
    retryAfterSeconds: secondsUntilWindowReset(limit.windowSeconds),
  }
}

export async function enforceOtpRequestLimits(
  input: { ip: string; email: string },
  consume: OtpLimitConsumer = consumeAuthLimit,
): Promise<void> {
  const normalizedEmail = normalizeOtpEmail(input.email)
  const limits: OtpLimitDefinition[] = [
    { scope: 'ip', identifier: input.ip, maxRequests: 5, windowSeconds: 60 },
    { scope: 'email', identifier: normalizedEmail, maxRequests: 1, windowSeconds: 60 },
    { scope: 'global', identifier: 'all', maxRequests: 100, windowSeconds: 3600 },
  ]

  for (const limit of limits) {
    const decision = await consume(limit)
    if (!decision.success) {
      throw new OtpRateLimitError('RATE_LIMITED', decision.retryAfterSeconds)
    }
  }
}

export async function enforceOtpVerificationLimits(
  input: { ip: string; email: string },
  consume: OtpLimitConsumer = consumeAuthLimit,
): Promise<void> {
  const normalizedEmail = normalizeOtpEmail(input.email)
  const limits: OtpLimitDefinition[] = [
    { scope: 'verification_ip', identifier: input.ip, maxRequests: 10, windowSeconds: 60 },
    { scope: 'verification_email', identifier: normalizedEmail, maxRequests: 5, windowSeconds: 60 },
    { scope: 'verification_global', identifier: 'all', maxRequests: 1_000, windowSeconds: 3600 },
  ]

  for (const limit of limits) {
    const decision = await consume(limit)
    if (!decision.success) {
      throw new OtpRateLimitError('RATE_LIMITED', decision.retryAfterSeconds)
    }
  }
}
