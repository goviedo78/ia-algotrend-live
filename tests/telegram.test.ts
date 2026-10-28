import assert from 'node:assert/strict'
import test from 'node:test'
import type { Trade } from '../src/lib/db'
import { formatTradeAlert, formatTradeSummary, sendTelegramMessage, sendTelegramPhoto, deliverTradeCard, getAlgoTrendTelegramConfig } from '../src/lib/telegram'

const trade: Trade = {
  id: 10, direction: 'LONG', signal_time: 1793000000, open_time: 1793000000,
  open_price: 100000, stop_loss: 98000, take_profit: null, close_time: null,
  close_price: null, close_reason: null, pnl_usd: null, pnl_pct: null, atr_pct: 1, status: 'OPEN',
}

test('initial summary is clearly historical and never presents an old trade as a new signal', () => {
  const text = formatTradeSummary([trade], null)
  assert.match(text, /RESUMEN INICIAL/)
  assert.match(text, /Últimas 5 operaciones/)
  assert.match(text, /Abierta/)
  assert.doesNotMatch(text, /📥 ENTRADA|📤 SALIDA/)
  assert.match(formatTradeSummary([], null), /Todavía no hay operaciones/)
})

test('entry includes five latest unique operations, current open valuation and demo identity', () => {
  const recent = Array.from({ length: 7 }, (_, i) => ({ ...trade, id: i + 1, open_time: trade.open_time - i * 3600 }))
  const text = formatTradeAlert('OPEN', trade, [trade, ...recent], { price: 101000, time: 1793003600 })
  assert.match(text, /GONOVI/)
  assert.match(text, /DEMO.*BTC\/USD.*1H/)
  assert.match(text, /Últimas 5 operaciones/)
  assert.equal((text.match(/🟡/g) ?? []).length, 5)
  assert.match(text, /\+1[.,]00% flotante/)
  assert.match(text, /Stop móvil/)
  assert.doesNotMatch(text, /Capital base|\$10,000/)
})

test('close shows negative and zero results honestly and prices with date and reason', () => {
  const closed: Trade = { ...trade, status: 'CLOSED', close_price: 98000, close_time: trade.open_time + 3600, close_reason: 'SL', pnl_pct: -2, pnl_usd: -2000 }
  const text = formatTradeAlert('CLOSE', closed, [trade], { price: 98000, time: closed.close_time! })
  assert.match(text, /SALIDA/)
  assert.match(text, /Stop loss/)
  assert.match(text, /−2[.,]00%/)
  assert.doesNotMatch(text, /🟡|flotante/)
  assert.match(text, /UTC/)
  const zero = formatTradeAlert('CLOSE', { ...closed, pnl_pct: 0 }, [], null)
  assert.match(zero, /0[.,]00%/)
  assert.doesNotMatch(zero, /\+0[.,]00%/)
})

test('short valuation reverses sign and missing quote never invents an open result', () => {
  const short = { ...trade, direction: 'SHORT' as const }
  assert.match(formatTradeAlert('OPEN', short, [], { price: 99000, time: trade.open_time }), /\+1[.,]00% flotante/)
  assert.match(formatTradeAlert('OPEN', short, [], null), /Sin cotización/)
  assert.doesNotMatch(formatTradeAlert('OPEN', short, [], null), /flotante/)
})

test('history unavailable is explicit and does not turn into an invented five-trade history', () => {
  assert.match(formatTradeAlert('OPEN', trade, null, null), /Historial temporalmente no disponible/)
})

test('signals require dedicated credentials and support an exclusive forum topic', () => {
  assert.equal(getAlgoTrendTelegramConfig({ TELEGRAM_BOT_TOKEN: 'pilot', TELEGRAM_CHAT_ID: '1' }), null)
  assert.deepEqual(getAlgoTrendTelegramConfig({ ALGOTREND_TELEGRAM_BOT_TOKEN: 'btc', ALGOTREND_TELEGRAM_CHAT_ID: '-1001', ALGOTREND_TELEGRAM_THREAD_ID: '42' }), { token: 'btc', chatId: '-1001', threadId: 42 })
  assert.equal(getAlgoTrendTelegramConfig({ ALGOTREND_TELEGRAM_BOT_TOKEN: 'btc' }), null)
})

test('Telegram errors and ambiguous timeouts are reported safely, with no automatic resend', async () => {
  let calls = 0
  const config = { token: 'private-token', chatId: '123', threadId: 42 }
  const denied = await sendTelegramMessage(config, 'test', async () => {
    calls++
    return new Response(JSON.stringify({ ok: false, error_code: 403, description: 'private-token' }), { status: 403 })
  })
  assert.deepEqual(denied, { status: 'failed', code: 403 })
  assert.equal(calls, 1)
  const timeout = await sendTelegramMessage(config, 'test', async () => { throw new Error('private-token') })
  assert.deepEqual(timeout, { status: 'unknown' })
})

test('Telegram delivery uses HTML, correct topic, and checks the API result', async () => {
  const result = await sendTelegramMessage({ token: 'test', chatId: '-1', threadId: 42 }, '<b>Entry</b>', async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    assert.equal(body.message_thread_id, 42)
    assert.equal(body.chat_id, '-1')
    assert.equal(body.parse_mode, 'HTML')
    assert.ok(init?.signal)
    return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }))
  })
  assert.deepEqual(result, { status: 'sent', messageId: 7 })
})

test('photo delivery uploads PNG bytes and a caption to the configured channel and topic', async () => {
  const result = await sendTelegramPhoto({ token: 'test', chatId: '-1', threadId: 42 }, new Uint8Array([1, 2, 3]), 'Caption', async (url, init) => {
    assert.ok(String(url).endsWith('/sendPhoto'))
    const form = init?.body
    assert.ok(form instanceof FormData)
    assert.equal(form.get('chat_id'), '-1')
    assert.equal(form.get('message_thread_id'), '42')
    assert.equal(form.get('caption'), 'Caption')
    const photo = form.get('photo')
    assert.ok(photo instanceof Blob)
    assert.equal(photo.type, 'image/png')
    assert.deepEqual([...new Uint8Array(await photo.arrayBuffer())], [1, 2, 3])
    assert.equal(init?.headers, undefined) // fetch supplies the multipart boundary.
    return new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }))
  })
  assert.deepEqual(result, { status: 'sent', messageId: 9 })
})

test('a rendering failure sends the event as text once, preserving delivery', async () => {
  let calls = 0
  const result = await deliverTradeCard({ token: 'test', chatId: '-1' }, { event: 'OPEN', trade, recent: [trade] }, {
    render: async () => { throw new Error('renderer failed') },
    fetchImpl: async (url, init) => {
      calls++
      assert.ok(String(url).endsWith('/sendMessage'))
      assert.match(JSON.parse(String(init?.body)).text, /ENTRADA · 🟢 COMPRA/)
      assert.match(JSON.parse(String(init?.body)).text, /Entrada: \$100,000\.00/)
      assert.doesNotMatch(JSON.parse(String(init?.body)).text, /aciertos|PnL/)
      assert.match(JSON.parse(String(init?.body)).text, /SL \(Stop loss\):/)
      assert.match(JSON.parse(String(init?.body)).text, /TP \(Objetivo\):/)
      assert.match(JSON.parse(String(init?.body)).text, /ATR: 1.00%/)
      return new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }))
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.status, 'sent')
})

test('ambiguous photo timeout and permission denial never produce a second message', async () => {
  for (const status of ['timeout', 'denied']) {
    let calls = 0
    const result = await deliverTradeCard({ token: 'test', chatId: '-1' }, { event: 'OPEN', trade, recent: [trade] }, {
      render: async () => new Uint8Array([1]),
      fetchImpl: async () => {
        calls++
        if (status === 'timeout') throw new Error('secret in network error')
        return new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 403 })
      },
    })
    assert.equal(calls, 1)
    assert.equal(result.status, status === 'timeout' ? 'unknown' : 'failed')
  }
})

test('an explicit image rejection falls back once to text', async () => {
  const methods: string[] = []
  const result = await deliverTradeCard({ token: 'test', chatId: '-1' }, { event: 'OPEN', trade, recent: [trade] }, {
    render: async () => new Uint8Array([1]),
    fetchImpl: async url => {
      methods.push(String(url).split('/').pop()!)
      return methods.length === 1
        ? new Response(JSON.stringify({ ok: false, error_code: 400 }), { status: 400 })
        : new Response(JSON.stringify({ ok: true, result: { message_id: 11 } }))
    },
  })
  assert.deepEqual(methods, ['sendPhoto', 'sendMessage'])
  assert.equal(result.status, 'sent')
})

test('sending a simulated close only contacts Telegram and leaves history untouched', async () => {
  const closed: Trade = { ...trade, id: 0, status: 'CLOSED', close_time: trade.open_time + 3600,
    close_price: 101000, pnl_pct: 1, pnl_usd: 1000, close_reason: 'TP' }
  const history = [closed]
  const before = structuredClone(history)
  Object.freeze(closed)
  Object.freeze(history)
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      // next/og bootstraps its bundled WASM through a local data URL.
      if (url.startsWith('data:')) return originalFetch(input, init)
      calls.push(url)
      assert.equal(url, 'https://api.telegram.org/botfixture-only/sendPhoto')
      assert.equal(init?.method, 'POST')
      assert.ok(init?.body instanceof FormData)
      return new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }))
    }
    const result = await deliverTradeCard({ token: 'fixture-only', chatId: '-1' }, { event: 'CLOSE', trade: closed, recent: history })
    assert.deepEqual(result, { status: 'sent', messageId: 99 })
    assert.deepEqual(calls, ['https://api.telegram.org/botfixture-only/sendPhoto'])
    assert.deepEqual(history, before)
  } finally {
    globalThis.fetch = originalFetch
  }
})
