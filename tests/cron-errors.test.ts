import test from 'node:test'
import assert from 'node:assert/strict'
import { isTransientUpstreamError } from '../src/lib/cron-errors'

test('an upstream outage is transient so the scheduler keeps calling', () => {
  // Lo que respondió el endpoint el 2026-09-23, cuando cron-job.org apagó el job BTC.
  assert.equal(isTransientUpstreamError(new Error('AbortError: This operation was aborted')), true)
  const abort = new Error('This operation was aborted')
  abort.name = 'AbortError'
  assert.equal(isTransientUpstreamError(abort), true)
  assert.equal(isTransientUpstreamError(new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })), true)
  assert.equal(isTransientUpstreamError(new Error('canceling statement due to statement timeout')), true)
})

test('a real bug still fails loudly', () => {
  assert.equal(isTransientUpstreamError(new TypeError("Cannot read properties of undefined (reading 'close')")), false)
  assert.equal(isTransientUpstreamError(new Error('Trade 363 is already closed')), false)
})
