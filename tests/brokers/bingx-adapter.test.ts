import assert from 'node:assert/strict'
import test from 'node:test'
import { BingxAdapter, buildBingxQuery, signBingxQuery } from '../../src/lib/brokers/adapters/bingx'

test('BingX query is encoded, sorted and signed deterministically', () => {
  const query = buildBingxQuery({ timestamp: 2, symbol: 'BTC-USDT', recvWindow: 10_000 })
  assert.equal(query, 'recvWindow=10000&symbol=BTC-USDT&timestamp=2')
  assert.equal(signBingxQuery('secret', query), '212def1a2aebfc2c6f0ef1b31af6b2b3d4fdc4481673dce71d09104803118e42')
})

test('one-way close uses fixed demo host, actual quantity and reduceOnly', async () => {
  const requestedUrls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrls.push(String(input))
    if (String(input).includes('/positionSide/dual')) {
      return Response.json({ code: 0, data: { dualSidePosition: false } })
    }
    return Response.json({ code: 0, data: { order: { orderId: '1', status: 'NEW', clientOrderID: 'client-1' } } })
  }
  const adapter = new BingxAdapter({
    credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2,
  })
  const result = await adapter.placeMarketOrder({
    symbol: 'BTC-USDT', direction: 'LONG', side: 'SELL', quantity: 0.0002,
    notionalUsd: 12, reduceOnly: true, clientOrderId: 'client-1',
  })
  const orderUrl = requestedUrls.at(-1) ?? ''
  assert.match(orderUrl, /^https:\/\/open-api-vst\.bingx\.com\/openApi\/swap\/v2\/trade\/order\?/)
  assert.match(orderUrl, /reduceOnly=true/)
  assert.match(orderUrl, /positionSide=BOTH/)
  assert.match(orderUrl, /clientOrderId=client-1/)
  assert.match(orderUrl, /quantity=0.0002/)
  assert.equal(result.clientOrderId, 'client-1')
})

test('hedge close omits unsupported reduceOnly and keeps position side', async () => {
  const requestedUrls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrls.push(String(input))
    if (String(input).includes('/positionSide/dual')) {
      return Response.json({ code: 0, data: { dualSidePosition: true } })
    }
    return Response.json({ code: 0, data: { orderID: '90071992547409930', status: 'NEW', clientOrderId: 'client-2' } })
  }
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })
  const result = await adapter.placeMarketOrder({ symbol: 'BTC-USDT', direction: 'SHORT', side: 'BUY', quantity: 0.0002, notionalUsd: 12, reduceOnly: true, clientOrderId: 'client-2' })
  const orderUrl = requestedUrls.at(-1) ?? ''
  assert.doesNotMatch(orderUrl, /reduceOnly=/)
  assert.match(orderUrl, /positionSide=SHORT/)
  assert.equal(result.brokerOrderId, '90071992547409930')
})

test('position mode accepts BingX string booleans', async () => {
  const requestedUrls: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrls.push(String(input))
    if (String(input).includes('/positionSide/dual')) {
      return Response.json({ code: 0, data: { dualSidePosition: 'false' } })
    }
    return Response.json({ code: 0, data: { order: { orderId: '3', status: 'NEW', clientOrderID: 'client-3' } } })
  }
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })

  await adapter.setLeverage('BTC-USDT', 'LONG', 1)
  await adapter.placeMarketOrder({ symbol: 'BTC-USDT', direction: 'LONG', side: 'BUY', quantity: 0.0002, notionalUsd: 100, reduceOnly: false, clientOrderId: 'client-3' })

  assert.match(requestedUrls[1], /side=BOTH/)
  assert.match(requestedUrls.at(-1) ?? '', /positionSide=BOTH/)
  assert.match(requestedUrls.at(-1) ?? '', /quoteOrderQty=100/)
  assert.doesNotMatch(requestedUrls.at(-1) ?? '', /quantity=/)
})

test('one-way positions infer direction from the signed position amount', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    code: 0,
    data: [
      {
        symbol: 'BTC-USDT',
        positionSide: 'BOTH',
        positionAmt: '-0.0002',
        availableAmt: '-0.0001',
        positionValue: '-12',
        avgPrice: '60000',
        leverage: '1',
      },
    ],
  })
  const adapter = new BingxAdapter({
    credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2,
  })
  const positions = await adapter.getPositions('BTC-USDT')
  assert.equal(positions.length, 1)
  assert.equal(positions[0].direction, 'SHORT')
  assert.equal(positions[0].quantity, 0.0002)
  assert.equal(positions[0].availableQuantity, 0.0001)
})

test('account-specific commission rates are read from BingX before sizing an opening', async () => {
  let requestedUrl = ''
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return Response.json({
      code: 0,
      data: { commission: { takerCommissionRate: '0.0005', makerCommissionRate: '0.0002' } },
    })
  }
  const adapter = new BingxAdapter({
    credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'LIVE', fetchImpl, now: () => 2,
  })

  assert.deepEqual(await adapter.getCommissionRates(), { taker: 0.0005, maker: 0.0002 })
  assert.match(requestedUrl, /\/openApi\/swap\/v2\/user\/commissionRate\?/)
})

test('missing order is the only broker query error treated as absent', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({ code: 80016, msg: 'order does not exist' })
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })
  assert.equal(await adapter.getOrder('BTC-USDT', 'client-3'), null)
})

test('documented BingX order states and accounting fields are normalized', async () => {
  const responses = [
    { status: 'PENDING', expected: 'NEW' },
    { status: 'CANCELLED', expected: 'CANCELED' },
    { status: 'FAILED', expected: 'REJECTED' },
  ] as const

  for (const response of responses) {
    const fetchImpl: typeof fetch = async () => Response.json({
      code: 0,
      data: { order: {
        orderId: '42', clientOrderId: 'client-state', status: response.status,
        executedQty: '0.0012', avgPrice: '4062', profit: '1.25', commission: '-0.02',
      } },
    })
    const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })
    const order = await adapter.getOrder('BTC-USDT', 'client-state')
    assert.equal(order?.status, response.expected)
    assert.equal(order?.realizedPnl, 1.25)
    assert.equal(order?.fee, -0.02)
  }
})

test('documented USD-M fill_orders response is normalized for reconciliation', async () => {
  let requestedUrl = ''
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return Response.json({
      code: 0,
      data: {
        fill_orders: [{
          filledTm: '2026-08-02T12:00:00Z',
          volume: '0.0012',
          price: '4062',
          amount: '4.8744',
          commission: '-0.0024',
          currency: 'USDT',
          orderId: '2083153846356615200',
          clientOrderId: 'gv-account-order',
        }, {
          filledTm: '2026-08-02T12:00:01Z',
          volume: '9',
          price: '4062',
          amount: '36558',
          commission: '-18',
          currency: 'USDT',
          orderId: '2083153846356615999',
          clientOrderId: 'manual-order',
        }],
      },
    })
  }
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'LIVE', fetchImpl, now: () => Date.parse('2026-08-02T12:01:00Z') })
  const fills = await adapter.getOrderFills('NCCOGOLD2USD-USDT', '2083153846356615200', new Date('2026-08-02T11:59:00Z'), 'gv-account-order')

  assert.match(requestedUrl, /\/openApi\/swap\/v2\/trade\/allFillOrders\?/)
  assert.doesNotMatch(requestedUrl, /orderId=/)
  assert.deepEqual(fills, [{
    brokerFillId: 'gv-account-order:2026-08-02T12:00:00.000Z:0.0012:4062:0',
    quantity: 0.0012,
    price: 4062,
    notionalUsd: 4.8744,
    fee: -0.0024,
    feeAsset: 'USDT',
    realizedPnl: 0,
    filledAt: '2026-08-02T12:00:00.000Z',
  }])
})

test('network failures are retryable and fail closed', async () => {
  const fetchImpl: typeof fetch = async () => { throw new Error('socket closed') }
  const adapter = new BingxAdapter({ credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl, now: () => 2 })
  await assert.rejects(adapter.getBalance(), { code: 'BINGX_NETWORK_ERROR', retryable: true })
})

test('concurrent accounts coalesce public contract and ticker requests', async () => {
  const originalFetch = globalThis.fetch
  let contractRequests = 0
  let tickerRequests = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/quote/contracts')) {
      contractRequests += 1
      return Response.json({
        code: 0,
        data: [{
          symbol: 'LOAD-USDT', quantityPrecision: 3, tradeMinQuantity: 0.001,
          tradeMinUSDT: 2, pricePrecision: 2, status: 1,
          apiStateOpen: 'true', apiStateClose: 'true', brokerState: 'true',
          maxLongLeverage: 10, maxShortLeverage: 10,
        }],
      })
    }
    tickerRequests += 1
    return Response.json({ code: 0, data: { price: '100' } })
  }

  try {
    const adapters = Array.from({ length: 20 }, (_, index) => new BingxAdapter({
      credentials: { apiKey: `key-${index}`, secretKey: `secret-${index}` },
      environment: 'DEMO',
    }))
    await Promise.all(adapters.map((adapter) => adapter.getInstrumentRules('LOAD-USDT')))
    await Promise.all(adapters.map((adapter) => adapter.getLastPrice('LOAD-USDT')))
    assert.equal(contractRequests, 1)
    assert.equal(tickerRequests, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('active public contracts do not depend on the brokerState metadata flag', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    code: 0,
    data: [{
      symbol: 'NCCOGOLD2USD-USDT', quantityPrecision: 4, tradeMinQuantity: 0.0005,
      tradeMinUSDT: 2, pricePrecision: 2, status: 1,
      apiStateOpen: 'true', apiStateClose: 'true', brokerState: false,
    }],
  })
  const adapter = new BingxAdapter({
    credentials: { apiKey: 'key', secretKey: 'secret' }, environment: 'DEMO', fetchImpl,
  })
  const rules = await adapter.getInstrumentRules('NCCOGOLD2USD-USDT')
  assert.equal(rules.openEnabled, true)
  assert.equal(rules.closeEnabled, true)
  assert.equal(rules.minimumQuantity, 0.0005)
})
