import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  enforceOtpRequestLimits,
  enforceOtpVerificationLimits,
  normalizeOtpEmail,
  OtpRateLimitError,
  type OtpLimitConsumer,
  type OtpLimitDefinition,
} from '../../src/lib/auth/rate-limit'

test('normalizes equivalent email spellings before rate limiting', () => {
  assert.equal(normalizeOtpEmail('  UsEr@Example.COM  '), 'user@example.com')
})

test('checks IP, normalized email and global request limits in order', async () => {
  const calls: OtpLimitDefinition[] = []
  const consume: OtpLimitConsumer = async (limit) => {
    calls.push(limit)
    return { success: true, retryAfterSeconds: limit.windowSeconds }
  }

  await enforceOtpRequestLimits({ ip: '203.0.113.8', email: 'User@Example.COM' }, consume)

  assert.deepEqual(calls.map(({ scope, identifier }) => ({ scope, identifier })), [
    { scope: 'ip', identifier: '203.0.113.8' },
    { scope: 'email', identifier: 'user@example.com' },
    { scope: 'global', identifier: 'all' },
  ])
})

test('stops before consuming the email bucket when the IP is limited', async () => {
  const calls: OtpLimitDefinition[] = []
  const consume: OtpLimitConsumer = async (limit) => {
    calls.push(limit)
    return {
      success: limit.scope !== 'ip',
      retryAfterSeconds: 37,
    }
  }

  await assert.rejects(
    enforceOtpRequestLimits({ ip: '203.0.113.9', email: 'user@example.com' }, consume),
    (error) => (
      error instanceof OtpRateLimitError
      && error.code === 'RATE_LIMITED'
      && error.retryAfterSeconds === 37
    ),
  )

  assert.deepEqual(calls.map((call) => call.scope), ['ip'])
})

test('verification attempts use separate distributed IP and email buckets', async () => {
  const calls: OtpLimitDefinition[] = []
  const consume: OtpLimitConsumer = async (limit) => {
    calls.push(limit)
    return { success: true, retryAfterSeconds: 60 }
  }

  await enforceOtpVerificationLimits({
    ip: '203.0.113.10',
    email: ' User@Example.COM ',
  }, consume)

  assert.deepEqual(calls.map(({ scope, identifier, maxRequests }) => ({
    scope,
    identifier,
    maxRequests,
  })), [
    { scope: 'verification_ip', identifier: '203.0.113.10', maxRequests: 10 },
    { scope: 'verification_email', identifier: 'user@example.com', maxRequests: 5 },
    { scope: 'verification_global', identifier: 'all', maxRequests: 1_000 },
  ])
})

test('OTP route only reports success after a real delivery', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/app/api/auth/otp/route.ts'), 'utf8')

  assert.match(source, /await enforceOtpRequestLimits/)
  assert.match(source, /await deliverEmailOtp\(email\)/)
  assert.match(source, /status: 429/)
  assert.doesNotMatch(source, /delivery: 'existing_code'/)
  assert.doesNotMatch(source, /rateLimiter\.check/)
})

test('OTP verification is protected by the distributed limiter', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/app/api/auth/verify/route.ts'), 'utf8')

  assert.match(source, /await enforceOtpVerificationLimits/)
  assert.match(source, /normalizeOtpEmail/)
  assert.doesNotMatch(source, /rateLimiter\.check/)
})
