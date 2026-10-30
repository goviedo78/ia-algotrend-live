import test from 'node:test'
import assert from 'node:assert/strict'
import { publishSignalNotice } from '../src/lib/signal-notices-runtime'
import { renderNoticeCard } from '../src/lib/telegram-notice-card'
import type { SignalNotice } from '../src/lib/signal-notices'

test('both notice cards render locally without emoji downloads', async () => {
  for (const kind of ['TRIGGER', 'PREALERT'] as const) {
    const notice: SignalNotice = { kind, identity: 'test', direction: 'SHORT', time: 1793239200, validUntil: 1793242800, probabilityPct: 91.2, openPrice: 80000, stopLoss: 79300, reversal: true }
    const png = Buffer.from(await renderNoticeCard(notice))
    assert.equal(png.readUInt32BE(16), 1080)
    assert.equal(png.readUInt32BE(20), 820)
  }
})

test('real notice delivery only writes the private ledger, uses dedicated channel and prevents resending', async t => {
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALGOTREND_TELEGRAM_BOT_TOKEN', 'ALGOTREND_TELEGRAM_CHAT_ID', 'ALGOTREND_TELEGRAM_THREAD_ID']
  const original = Object.fromEntries(names.map(k => [k, process.env[k]]))
  t.after(() => { for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name] } })
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://notice-test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.ALGOTREND_TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.ALGOTREND_TELEGRAM_CHAT_ID = '-123'
  delete process.env.ALGOTREND_TELEGRAM_THREAD_ID
  const keys = new Set<string>()
  const calls: string[] = []
  let sends = 0
  const nativeFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('data:')) return nativeFetch(input, init)
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url.includes('/rest/v1/algotrend_telegram_notices')) {
      const body = JSON.parse(String(init?.body))
      if (init?.method === 'POST') {
        if (keys.has(body.notice_key)) return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 })
        keys.add(body.notice_key)
      } else { assert.equal(init?.method, 'PATCH'); assert.equal(body.state, 'sent'); assert.equal(body.message_id, 3) }
      return new Response(null, { status: 201 })
    }
    assert.match(url, /^https:\/\/api.telegram.org\/bottest-token\/sendPhoto$/)
    assert.equal(init?.method, 'POST')
    assert.ok(init?.body instanceof FormData)
    assert.equal(init.body.get('chat_id'), '-123')
    assert.match(String(init.body.get('caption')), /Señal sin confirmar/)
    sends++
    return Response.json({ ok: true, result: { message_id: 3 } })
  })
  const notice: SignalNotice = { kind: 'PREALERT', identity: 'prealert:test', direction: 'LONG', time: 1793239200, validUntil: Date.now() / 1000 + 120, probabilityPct: 90 }
  await publishSignalNotice(notice)
  await publishSignalNotice(notice)
  assert.equal(sends, 1)
  assert.ok(calls[0].includes('algotrend_telegram_notices'))
  assert.ok(calls.every(call => !/algotrend_trades|broker|cron/.test(call)))
})
