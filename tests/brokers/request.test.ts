import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '../../src/lib/brokers/auth'
import { readBrokerJson, readBrokerRawJson } from '../../src/lib/brokers/request'

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://broker.example/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

test('broker JSON parser accepts bounded application/json bodies', async () => {
  assert.deepEqual(await readBrokerJson(post('{"ok":true}')), { ok: true })
})

test('broker JSON parser rejects unsupported content types and oversized bodies', async () => {
  await assert.rejects(
    readBrokerRawJson(post('{}', { 'content-type': 'text/plain' })),
    { code: 'CONTENT_TYPE_UNSUPPORTED' },
  )
  await assert.rejects(readBrokerRawJson(post('12345'), 4), { code: 'REQUEST_BODY_TOO_LARGE' })
})

test('same-origin guard checks scheme and rejects malformed origins', () => {
  assert.doesNotThrow(() => assertSameOrigin(post('{}', { origin: 'https://broker.example' })))
  assert.throws(() => assertSameOrigin(post('{}', { origin: 'http://broker.example' })), { code: 'ORIGIN_DENIED' })
  assert.throws(() => assertSameOrigin(post('{}', { origin: 'not-a-url' })), { code: 'ORIGIN_DENIED' })
})
