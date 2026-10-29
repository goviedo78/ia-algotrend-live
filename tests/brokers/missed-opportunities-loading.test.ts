import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMissedOpportunities } from '../../src/lib/brokers/missed-opportunities'

test('percentage rejection history never treats the million-dollar cap as broker balance when balance cannot be read', async () => {
  const previousFetch = globalThis.fetch
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://broker-fixture.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key'
  const signal = { id: 'signal', external_signal_id: 'algotrend-btc-1h-100-open-1', strategy_code: 'ALGOTREND_BTC_1H', symbol: 'BTC-USDT', action: 'OPEN', direction: 'LONG', signal_time: '2026-10-29T10:00:00Z', reference_price: 100000 }
  globalThis.fetch = async (input) => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    let rows: unknown = []
    if (url.pathname.endsWith('/broker_order_intents')) rows = [{ id: 'intent', connection_id: 'connection', signal_id: 'signal', action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', rejection_code: 'RISK_DAILY_LOSS_LIMIT', created_at: signal.signal_time }]
    if (url.pathname.endsWith('/broker_connections')) rows = [{ id: 'connection', label: 'Cuenta', status: 'ACTIVE', broker: 'BINGX', environment: 'LIVE' }]
    if (url.pathname.endsWith('/broker_risk_policies')) rows = [{ connection_id: 'connection', enabled: true, sizing_mode: 'EQUITY_PERCENT', declared_capital_usd: 1000000, exposure_per_order_pct: 50, fixed_notional_usd: 500000, suggested_notional_per_order_usd: 500000 }]
    if (url.pathname.endsWith('/broker_signals') && !url.searchParams.has('action')) rows = [signal]
    if (url.pathname.endsWith('/broker_signals') && url.searchParams.has('action')) rows = [{ ...signal, id: 'close', external_signal_id: 'algotrend-btc-1h-100-close-2', action: 'CLOSE', signal_time: '2026-10-29T11:00:00Z', reference_price: 103000 }]
    if (Number(url.searchParams.get('offset') ?? 0) > 0) rows = []
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const result = await loadMissedOpportunities({ userId: 'holder' })
    assert.equal(result.length, 1)
    assert.equal(result[0].notionalUsd, null, 'unknown real balance must show no USD estimate, never $500000')
    assert.equal(result[0].missedGrossPnlUsd, null)
    assert.equal(result[0].missedReturnPct, 3)
    assert.equal(result[0].canRetry, false)
  } finally {
    globalThis.fetch = previousFetch
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl
    if (oldKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey
  }
})

test('history estimates from each real account balance and blocks only the connection whose daily cut is reached', async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const { encryptCredentials } = await import('../../src/lib/brokers/crypto')
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://broker-fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-key', BROKER_KEY_PROVIDER: 'RSA',
    BROKER_ENVELOPE_PUBLIC_KEY_B64: Buffer.from(keys.publicKey).toString('base64'), BROKER_ENVELOPE_PRIVATE_KEY_B64: Buffer.from(keys.privateKey).toString('base64'),
  }
  const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  const previousFetch = globalThis.fetch
  Object.assign(process.env, env)
  try {
    const connections = ['one', 'two'].map(id => ({ id, user_id: 'holder', label: id, status: 'ACTIVE', broker: 'BINGX', environment: 'DEMO' }))
    const envelopes = await Promise.all(connections.map(async connection => {
      const e = await encryptCredentials({ apiKey: connection.id, secretKey: 'fake-secret' }, { connectionId: connection.id, userId: 'holder', broker: 'BINGX', environment: 'DEMO' })
      return { connection_id: connection.id, ciphertext: e.ciphertext, encrypted_data_key: e.encryptedDataKey, iv: e.iv, auth_tag: e.authTag, aad: e.aad, kms_key_id: e.kmsKeyId, algorithm: e.algorithm, version: e.version }
    }))
    const policies = connections.map(c => ({ connection_id: c.id, enabled: true, sizing_mode: 'EQUITY_PERCENT', declared_capital_usd: 1000000, exposure_per_order_pct: 50, fixed_notional_usd: 500000, suggested_notional_per_order_usd: 500000, margin_reserve_pct: 0, min_available_margin_usd: 0, max_leverage: 1, daily_loss_limit_pct: 2 }))
    const signal = { id: 'signal', external_signal_id: 'algotrend-btc-1h-100-open-1', strategy_code: 'ALGOTREND_BTC_1H', symbol: 'BTC-USDT', action: 'OPEN', direction: 'LONG', signal_time: '2026-10-29T10:00:00Z', reference_price: 100000 }
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      const headers = new Headers(init?.headers)
      let body: unknown
      if (url.hostname === 'open-api-vst.bingx.com') {
        assert.equal(init?.method ?? 'GET', 'GET', 'history cannot trade or change leverage')
        const equity = headers.get('X-BX-APIKEY') === 'one' ? 197.8199 : 400
        body = url.pathname.endsWith('/balance')
          ? { code: 0, data: { balance: { asset: 'USDT', equity, availableMargin: equity, usedMargin: 0 } } }
          : { code: 0, data: { commission: { takerCommissionRate: 0.0005, makerCommissionRate: 0 } } }
      } else if (url.pathname.endsWith('/rpc/get_broker_risk_runtime')) {
        const id = JSON.parse(String(init?.body)).target_connection_id
        body = [{ compound_capital_usd: 1000000, daily_net_pnl_usd: id === 'one' ? -3.965186 : 0 }]
      } else {
        assert.equal(init?.method ?? 'GET', 'GET', 'history cannot mutate database rows')
        let rows: unknown[] = []
        if (url.pathname.endsWith('/broker_connections')) rows = connections
        if (url.pathname.endsWith('/broker_credential_envelopes')) rows = envelopes
        if (url.pathname.endsWith('/broker_risk_policies')) rows = policies
        if (url.pathname.endsWith('/broker_signals') && !url.searchParams.has('action')) rows = [signal]
        if (url.pathname.endsWith('/broker_order_intents')) rows = connections.map(c => ({ id: 'intent-' + c.id, connection_id: c.id, signal_id: signal.id, action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', rejection_code: 'RISK_DAILY_LOSS_LIMIT', created_at: signal.signal_time }))
        const id = url.searchParams.get('id') ?? url.searchParams.get('connection_id')
        if (id?.startsWith('eq.')) rows = rows.filter(row => (row as {id?: string; connection_id?: string}).id === id.slice(3) || (row as {connection_id?: string}).connection_id === id.slice(3))
        if (Number(url.searchParams.get('offset') ?? 0) > 0) rows = []
        body = headers.get('accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const history = await loadMissedOpportunities({ userId: 'holder' })
    const one = history.find(item => item.connectionId === 'one')!
    const two = history.find(item => item.connectionId === 'two')!
    assert.equal(one.notionalUsd, 98.90995)
    assert.equal(two.notionalUsd, 200)
    assert.equal(one.canRetry, false)
    assert.match(one.retryBlockedReason!, /3\.97 USD; límite 2% \(3\.96 USD\)/)
    assert.equal(two.canRetry, true)
    assert.equal(two.retryBlockedReason, null)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
  }
})
