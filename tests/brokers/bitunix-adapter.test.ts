import assert from 'node:assert/strict'
import test from 'node:test'
import { BitunixAdapter, fetchBitunixTickerPrice, signBitunixRequest } from '../../src/lib/brokers/adapters/bitunix'
import { BingxAdapter } from '../../src/lib/brokers/adapters/bingx'
import { BrokerPlatformError } from '../../src/lib/brokers/errors'
import { calculateOpeningFundingRequirement, defaultTakerFeeRate } from '../../src/lib/brokers/funding-requirement'

const credentials = { apiKey: 'testkey', secretKey: 'testsecret' }
const now = () => 1700000000000
const success = (data: unknown) => Response.json({ code: 0, data })
const balance = { marginCoin: 'USDT', available: '100', frozen: '2', margin: '10', crossUnrealizedPNL: '-3', isolationUnrealizedPNL: '1' }
const position = { positionId: '90071992547409931', symbol: 'BTCUSDT', qty: '0.002', avgOpenPrice: '60000', unrealizedPNL: '2', side: 'LONG', leverage: 1 }
const open = { symbol: 'BTC-USDT', direction: 'LONG', side: 'BUY', quantity: 0.002, notionalUsd: 120, reduceOnly: false, clientOrderId: 'gonovi-order-1' } as const

function adapter(fetchImpl: typeof fetch) {
  return new BitunixAdapter({ credentials, environment: 'LIVE', fetchImpl, now })
}

test('Bitunix double SHA256 signature has a fixed independently calculated vector', () => {
  assert.equal(signBitunixRequest('testsecret', 'testkey', 'nonce', '1700000000000', { marginCoin: 'USDT' }), 'e5540e3817fc7486b02585e0e2906761ffe769824afbc46c2ccdce49aaaafaba')
  assert.equal(signBitunixRequest('s', 'k', 'n', '1', { z: 2, a: 1 }), signBitunixRequest('s', 'k', 'n', '1', { a: 1, z: 2 }))
})

test('Bitunix signs headers, fixes the HTTPS host and never exposes keys in the URL', async () => {
  const nonces = new Set<string>()
  const api = adapter(async (url, init) => {
    assert.equal(String(url), 'https://fapi.bitunix.com/api/v1/futures/account?marginCoin=USDT')
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('api-key'), credentials.apiKey)
    assert.equal(headers.get('sign'), signBitunixRequest(credentials.secretKey, credentials.apiKey, headers.get('nonce')!, String(now()), { marginCoin: 'USDT' }))
    assert.equal(init?.redirect, 'error')
    assert.equal(init?.cache, 'no-store')
    nonces.add(headers.get('nonce')!)
    return success([balance])
  })
  assert.deepEqual(await api.getBalance(), { asset: 'USDT', equity: 110, availableMargin: 97, usedMargin: 12 })
  await api.getBalance()
  assert.equal(nonces.size, 2)
})

test('50 independent accounts never share private account data or credentials', async () => {
  const keys = new Set<string>()
  const fetchImpl: typeof fetch = async (_url, init) => {
    const key = new Headers(init?.headers).get('api-key')!
    keys.add(key)
    return success([{ ...balance, available: key.slice(8) }])
  }
  const results = await Promise.all(Array.from({ length: 50 }, (_, index) => new BitunixAdapter({ credentials: { apiKey: `account-${index + 100}`, secretKey: `secret-${index}` }, environment: 'LIVE', fetchImpl }).getBalance()))
  assert.equal(keys.size, 50)
  assert.equal(results[0].availableMargin, 97)
  assert.equal(results[49].availableMargin, 146)
})

test('live account endpoint also returns a single object rather than the documented example array', async () => {
  const result = await adapter(async () => success(balance)).getBalance()
  assert.equal(result.availableMargin, 97)
})

test('malformed balances, network failures and broker errors fail without leaking raw messages', async () => {
  await assert.rejects(adapter(async () => success([{ ...balance, available: 'invalid' }])).getBalance(), { code: 'BITUNIX_INVALID_RESPONSE', retryable: true })
  await assert.rejects(adapter(async () => Response.json({})).getBalance(), { code: 'BITUNIX_INVALID_RESPONSE', retryable: true })
  await assert.rejects(adapter(async () => { throw new Error('testsecret') }).getBalance(), error => error instanceof BrokerPlatformError && !error.message.includes('testsecret') && error.retryable)
  for (const code of [10004, 10005, 10006, 10007, 30042]) {
    await assert.rejects(adapter(async () => Response.json({ code, msg: 'testkey testsecret' })).getBalance(), error => error instanceof BrokerPlatformError && !error.message.includes('testsecret') && error.retryable === [10005, 10006, 30042].includes(code))
  }
})

test('validation reads account and position mode without sending any modifying request', async () => {
  const api = adapter(async (url, init) => {
    assert.equal(init?.method, 'GET')
    return success(String(url).includes('position_mode') ? { positionMode: 'ONE_WAY' } : [balance])
  })
  const validation = await api.validateCredentials()
  assert.equal(validation.canRead, true)
  assert.equal(validation.canTradePerpetuals, null)
  await assert.rejects(adapter(async url => success(String(url).includes('position_mode') ? { positionMode: 'unknown' } : [balance])).validateCredentials(), { code: 'BITUNIX_INVALID_RESPONSE' })
  assert.throws(() => new BitunixAdapter({ credentials, environment: 'DEMO' }), { code: 'BITUNIX_DEMO_UNSUPPORTED' })
})

test('Bitunix execution starts disabled; BingX operation is unaffected by its switch', async () => {
  const previous = process.env.BITUNIX_EXECUTION_ENABLED
  delete process.env.BITUNIX_EXECUTION_ENABLED
  try {
    const api = adapter(async () => { throw new Error('must not send a request') })
    await assert.rejects(api.placeMarketOrder(open), { code: 'BITUNIX_EXECUTION_DISABLED' })
    await assert.rejects(api.setLeverage('BTC-USDT', 'LONG', 1), { code: 'BITUNIX_EXECUTION_DISABLED' })
    const bingx = new BingxAdapter({ credentials, environment: 'DEMO', fetchImpl: async url => success(String(url).includes('/positionSide/') ? { dualSidePosition: false } : { orderId: 'b1', status: 'NEW' }) })
    assert.equal((await bingx.placeMarketOrder(open)).brokerOrderId, 'b1')
  } finally {
    if (previous === undefined) delete process.env.BITUNIX_EXECUTION_ENABLED
    else process.env.BITUNIX_EXECUTION_ENABLED = previous
  }
})

async function enabled(run: () => Promise<void>) {
  const previous = process.env.BITUNIX_EXECUTION_ENABLED
  process.env.BITUNIX_EXECUTION_ENABLED = 'true'
  try { await run() } finally {
    if (previous === undefined) delete process.env.BITUNIX_EXECUTION_ENABLED
    else process.env.BITUNIX_EXECUTION_ENABLED = previous
  }
}

test('one-way opens use base quantity, signed JSON; closes are reduce-only with owned quantity', () => enabled(async () => {
  const bodies: Array<Record<string, unknown>> = []
  const api = adapter(async (url, init) => {
    if (String(url).includes('position_mode')) return success({ positionMode: 'ONE_WAY' })
    const body = String(init?.body)
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('sign'), signBitunixRequest(credentials.secretKey, credentials.apiKey, headers.get('nonce')!, String(now()), {}, body))
    bodies.push(JSON.parse(body))
    return success({ orderId: '90071992547409930', clientId: open.clientOrderId })
  })
  assert.equal((await api.placeMarketOrder(open)).status, 'NEW')
  await api.placeMarketOrder({ ...open, side: 'SELL', reduceOnly: true, quantity: 0.001 })
  assert.deepEqual(bodies.map(body => [body.symbol, body.side, body.qty, body.reduceOnly]), [['BTCUSDT', 'BUY', '0.002', false], ['BTCUSDT', 'SELL', '0.001', true]])
  assert.equal(bodies[0].quoteOrderQty, undefined)
}))

test('hedge closes select exact positionId and Bitunix original side; never close-all or mutate position mode', () => enabled(async () => {
  for (const direction of ['LONG', 'SHORT'] as const) {
    const api = adapter(async (url, init) => {
      const path = new URL(String(url)).pathname
      if (path.endsWith('position_mode')) return success({ positionMode: 'HEDGE' })
      if (path.endsWith('get_pending_positions')) {
        assert.equal(new URL(String(url)).searchParams.get('includeSubAccounts'), 'false')
        return success([{ ...position, side: direction }])
      }
      assert.equal(path, '/api/v1/futures/trade/place_order')
      const body = JSON.parse(String(init?.body))
      assert.equal(body.positionId, position.positionId)
      assert.equal(body.side, direction === 'LONG' ? 'BUY' : 'SELL')
      assert.equal(body.tradeSide, 'CLOSE')
      assert.equal(body.qty, '0.001')
      return success({ orderId: '1', clientId: open.clientOrderId })
    })
    await api.placeMarketOrder({ ...open, direction, side: direction === 'LONG' ? 'SELL' : 'BUY', quantity: 0.001, reduceOnly: true })
  }
}))

test('hedge closes fail closed on ambiguous, missing or insufficient position', () => enabled(async () => {
  for (const positions of [[], [position, position], [{ ...position, qty: '0.0001' }]]) {
    const api = adapter(async url => {
      assert.ok(!String(url).includes('place_order'))
      return success(String(url).includes('position_mode') ? { positionMode: 'HEDGE' } : positions)
    })
    await assert.rejects(api.placeMarketOrder({ ...open, reduceOnly: true, side: 'SELL' }), { code: 'BITUNIX_CLOSE_POSITION_MISMATCH' })
  }
}))

test('an ambiguous order submission is not retried inside the adapter and can be found by the same clientId', () => enabled(async () => {
  let submissions = 0
  const api = adapter(async (url, init) => {
    const path = new URL(String(url)).pathname
    if (path.endsWith('position_mode')) return success({ positionMode: 'ONE_WAY' })
    if (path.endsWith('place_order')) {
      submissions++
      assert.equal(JSON.parse(String(init?.body)).clientId, open.clientOrderId)
      throw new Error('connection lost after exchange accepted the order')
    }
    assert.equal(new URL(String(url)).searchParams.get('clientId'), open.clientOrderId)
    return success({ orderId: '123', symbol: 'BTCUSDT', clientId: open.clientOrderId, status: 'FILLED', tradeQty: '0.002' })
  })
  await assert.rejects(api.placeMarketOrder(open), { code: 'BITUNIX_NETWORK_ERROR', retryable: true })
  assert.equal((await api.getOrder(open.symbol, open.clientOrderId))?.brokerOrderId, '123')
  assert.equal(submissions, 1)
}))

test('positions use platform canonical symbols and preserve long/short exposure', async () => {
  const api = adapter(async () => success([position, { ...position, side: 'SHORT', unrealizedPNL: '-2' }]))
  const positions = await api.getPositions()
  assert.deepEqual(positions.map(item => [item.symbol, item.direction, item.markPrice]), [['BTC-USDT', 'LONG', 61000], ['BTC-USDT', 'SHORT', 61000]])
})

test('contract rules use Bitunix precision, minimum, maximum and API state', async () => {
  const api = adapter(async () => success([{ symbol: 'BTCUSDT', basePrecision: 4, quotePrecision: 1, minTradeVolume: '0.0001', maxMarketOrderVolume: '120', maxLeverage: 125, symbolStatus: 'OPEN', isApiSupported: true }]))
  const rules = await api.getInstrumentRules('BTC-USDT')
  assert.equal(rules.quantityStep, 0.0001)
  assert.equal(rules.maximumQuantity, 120)
  assert.equal(rules.openEnabled, true)
  await assert.rejects(adapter(async () => success([])).getInstrumentRules('BTC-USDT'), { code: 'INSTRUMENT_NOT_FOUND' })
})

test('public prices single-flight for 50 callers without sharing BingX transport or any API keys', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++
    assert.ok(String(url).startsWith('https://fapi.bitunix.com/'))
    assert.equal(new Headers(init?.headers).has('api-key'), false)
    return success([{ symbol: 'BTCUSDT', lastPrice: '60000' }])
  }
  try {
    const results = await Promise.all(Array.from({ length: 50 }, () => fetchBitunixTickerPrice('BTC-USDT', { ttlMs: 1100 })))
    assert.equal(calls, 1)
    assert.ok(results.every(value => value === 60000))
  } finally { globalThis.fetch = original }
})

test('order recovery uses exact clientId, treats only documented not-found as absent and keeps int64 strings', async () => {
  const api = adapter(async url => {
    assert.equal(new URL(String(url)).searchParams.get('clientId'), open.clientOrderId)
    return success({ orderId: '90071992547409931', clientId: open.clientOrderId, symbol: 'BTCUSDT', status: 'PART_FILLED', tradeQty: '0.001', price: '1' })
  })
  const order = await api.getOrder('BTC-USDT', open.clientOrderId)
  assert.equal(order?.brokerOrderId, '90071992547409931')
  assert.equal(order?.status, 'PARTIALLY_FILLED')
  assert.equal(order?.averagePrice, null)
  assert.equal(await adapter(async () => Response.json({ code: 20007 })).getOrder('BTC-USDT', 'id'), null)
  await assert.rejects(adapter(async () => Response.json({ code: 10005 })).getOrder('BTC-USDT', 'id'), { code: 'BITUNIX_10005' })
  await assert.rejects(adapter(async () => success({ orderId: 90071992547409930 })).getOrder('BTC-USDT', 'id'), { code: 'BITUNIX_INVALID_RESPONSE' })
})

test('fills paginate, deduplicate and isolate exact order, symbol and client; missing fee cannot become zero', async () => {
  const fill = { tradeId: 'fill-1', orderId: 'order-1', symbol: 'BTCUSDT', clientId: 'client-1', qty: '0.001', price: '60000', fee: '0.036', realizedPNL: '1', ctime: now() }
  let calls = 0
  const api = adapter(async url => {
    assert.equal(new URL(String(url)).searchParams.get('orderId'), 'order-1')
    calls++
    return success({ total: 101, tradeList: calls === 1 ? Array.from({ length: 100 }, () => fill) : [{ ...fill, tradeId: 'fill-2' }] })
  })
  const fills = await api.getOrderFills('BTC-USDT', 'order-1', new Date(now()), 'client-1')
  assert.equal(calls, 2)
  assert.deepEqual(fills.map(item => [item.brokerFillId, item.fee, item.realizedPnl]), [['fill-1', 0.036, 1], ['fill-2', 0.036, 1]])
  assert.deepEqual(await adapter(async () => success({ tradeList: [{ ...fill, orderId: 'foreign' }, { ...fill, clientId: 'foreign' }] })).getOrderFills('BTC-USDT', 'order-1', new Date(now()), 'client-1'), [])
  await assert.rejects(adapter(async () => success({ tradeList: [{ ...fill, fee: undefined }] })).getOrderFills('BTC-USDT', 'order-1', new Date(now())), { code: 'BITUNIX_INVALID_RESPONSE' })
})

test('funding estimates reserve the correct broker fee without changing BingX values', async () => {
  assert.equal(defaultTakerFeeRate('BINGX'), 0.0005)
  assert.equal(defaultTakerFeeRate('BITUNIX'), 0.0006)
  const rates = await adapter(async () => { throw new Error('no private fee endpoint') }).getCommissionRates()
  assert.equal(calculateOpeningFundingRequirement({ notionalUsd: 1000, leverage: 1, reserveUsd: 0, takerFeeRate: rates.taker }).openingFeeUsd, 0.6)
})
