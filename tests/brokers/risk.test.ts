import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateRisk as evaluateRiskRaw } from '../../src/lib/brokers/risk'
import { managedSizingCapitalUsd, planOpeningNotional } from '../../src/lib/brokers/sizing'
import type { RiskPolicy } from '../../src/lib/brokers/domain'
import type { RiskEvaluationInput } from '../../src/lib/brokers/risk'

function evaluateRisk(input: Omit<RiskEvaluationInput, 'openingFeeRate'> & { openingFeeRate?: number }) {
  return evaluateRiskRaw({ ...input, openingFeeRate: input.openingFeeRate ?? 0 })
}

const policy: RiskPolicy = {
  enabled: true,
  allowedSymbols: ['BTC-USDT'],
  sizingMode: 'FIXED_NOTIONAL',
  fixedNotionalUsd: 8,
  maxNotionalPerOrderUsd: 8,
  maxTotalExposureUsd: 8,
  maxLeverage: 1,
  maxOpenPositions: 1,
  maxOrdersPerMinute: 2,
  dailyLossLimitUsd: 3,
  minAvailableMarginUsd: 50,
  closeOnlyWhenSuspended: true,
  declaredCapitalUsd: 100,
  riskProfile: 'MODERATE',
  exposurePerOrderPct: 8,
  maxTotalExposurePct: 16,
  dailyLossLimitPct: 3,
  marginReservePct: 50,
  suggestedNotionalPerOrderUsd: 8,
  suggestedMaxTotalExposureUsd: 16,
  suggestedDailyLossLimitUsd: 3,
  suggestedMinAvailableMarginUsd: 50,
  version: 2,
}

const rules = {
  symbol: 'BTC-USDT', quantityStep: 0.0001, minimumQuantity: 0.0001,
  maximumQuantity: 10, minimumNotional: 1, pricePrecision: 1, quantityPrecision: 4,
  openEnabled: true, closeEnabled: true, maximumLongLeverage: 125, maximumShortLeverage: 125,
}

test('open sizing is derived from fixed notional and broker step', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [], rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })
  assert.equal(result.quantity, 0.0002)
  assert.equal(result.notionalUsd, 8)
  assert.equal(result.leverage, 1)
  assert.equal(result.reduceOnly, false)
})

test('an exact BTC minimum lot is not lost to floating-point division', () => {
  const exactMinimumRules = {
    ...rules,
    quantityStep: 0.001,
    minimumQuantity: 0.001,
    quantityPrecision: 3,
    minimumNotional: 100,
  }
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100_000,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [],
    rules: exactMinimumRules,
    policy: {
      ...policy,
      fixedNotionalUsd: 100,
      maxNotionalPerOrderUsd: 100,
      maxTotalExposureUsd: 100,
      minAvailableMarginUsd: 0,
    },
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })

  assert.equal(result.quantity, 0.001)
  assert.equal(result.notionalUsd, 100)
})

test('arbitrary USD allocations preserve the exact quote amount requested by the user', () => {
  const price = 63_061.4

  for (const requestedNotionalUsd of [100, 137.25, 1_000]) {
    const result = evaluateRisk({
      action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price,
      sizingCapitalUsd: requestedNotionalUsd, availableMargin: requestedNotionalUsd,
      positions: [], ownedPositions: [], rules,
      policy: {
        ...policy,
        declaredCapitalUsd: requestedNotionalUsd,
        exposurePerOrderPct: 100,
        maxTotalExposurePct: 100,
        fixedNotionalUsd: requestedNotionalUsd,
        maxNotionalPerOrderUsd: requestedNotionalUsd,
        maxTotalExposureUsd: requestedNotionalUsd,
        minAvailableMarginUsd: 0,
      },
      ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    })

    assert.equal(result.notionalUsd, requestedNotionalUsd)
  }
})

test('fixed sizing never changes the configured quote amount to fit the live balance', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100,
    sizingCapitalUsd: 100, availableMargin: 99.9, positions: [], ownedPositions: [],
    rules: { ...rules, quantityStep: 0.001, quantityPrecision: 3 },
    policy: {
      ...policy,
      fixedNotionalUsd: 90,
      maxNotionalPerOrderUsd: 90,
      maxTotalExposureUsd: 90,
      minAvailableMarginUsd: 10,
      marginReservePct: 10,
    },
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }), { code: 'RISK_MARGIN_RESERVE' })
})

test('fixed sizing sends the exact configured quote amount when order plus reserve fit', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 64_458.5,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [],
    rules,
    policy: {
      ...policy,
      fixedNotionalUsd: 90,
      maxNotionalPerOrderUsd: 90,
      maxTotalExposureUsd: 90,
      minAvailableMarginUsd: 10,
      marginReservePct: 10,
    },
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })

  assert.equal(result.notionalUsd, 90)
  assert.equal(result.quantity, 0.0013)
})

test('the displayed cent is the strict threshold for margin, reserve and opening fee', () => {
  const input = {
    action: 'OPEN' as const, direction: 'LONG' as const, symbol: 'BTC-USDT', price: 64_458.5,
    sizingCapitalUsd: 100, positions: [], ownedPositions: [], rules,
    policy: {
      ...policy,
      fixedNotionalUsd: 90,
      maxNotionalPerOrderUsd: 90,
      maxTotalExposureUsd: 90,
      minAvailableMarginUsd: 10,
      marginReservePct: 10,
    },
    openingFeeRate: 0.0005,
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }

  assert.throws(() => evaluateRisk({ ...input, availableMargin: 100.04 }), { code: 'RISK_MARGIN_RESERVE' })
  assert.equal(evaluateRisk({ ...input, availableMargin: 100.05 }).notionalUsd, 90)
})

test('the broker minimum lot never overrides an authorized notional limit', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100_100,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [],
    rules: {
      ...rules,
      quantityStep: 0.001,
      minimumQuantity: 0.001,
      quantityPrecision: 3,
      minimumNotional: 100,
    },
    policy: {
      ...policy,
      fixedNotionalUsd: 100,
      maxNotionalPerOrderUsd: 100,
      maxTotalExposureUsd: 100,
      minAvailableMarginUsd: 0,
    },
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }), { code: 'RISK_QUANTITY_OUT_OF_RANGE' })
})

test('new positions fail closed when policy is disabled', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [], rules, policy: { ...policy, enabled: false },
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }), { code: 'RISK_POLICY_DISABLED' })
})

test('position limit only counts symbols managed by the risk policy', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'ETH-USDT', direction: 'LONG', quantity: 0.01, availableQuantity: 0.01,
      entryPrice: 3_000, markPrice: 3_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [],
  })

  assert.equal(result.symbol, 'BTC-USDT')
  assert.equal(result.quantity, 0.0002)
})

test('position limit still blocks when the connection already owns a position in a managed symbol', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0001, availableQuantity: 0.0001,
      entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [{ symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0001 }],
  }), { code: 'RISK_POSITION_LIMIT' })
})

test('suspended connections can only close their own broker position reduce-only', () => {
  const result = evaluateRisk({
    action: 'CLOSE', direction: 'SHORT', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 1, rules, policy: { ...policy, enabled: false }, ordersLastMinute: 99,
    realizedPnlTodayUsd: -100, connectionStatus: 'SUSPENDED', positions: [{
      symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0003, availableQuantity: 0.0003,
      entryPrice: 41_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0.3,
    }],
    ownedPositions: [{ symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0003 }],
  })
  assert.equal(result.side, 'BUY')
  assert.equal(result.quantity, 0.0003)
  assert.equal(result.reduceOnly, true)
})

test('close fails when the connection has no position of its own', () => {
  assert.throws(() => evaluateRisk({
    action: 'CLOSE', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [], rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }), { code: 'RISK_POSITION_NOT_FOUND' })
})

test('ownership: close never touches a position this connection did not open', () => {
  assert.throws(() => evaluateRisk({
    action: 'CLOSE', direction: 'SHORT', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.001, availableQuantity: 0.001,
      entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [],
  }), { code: 'RISK_POSITION_NOT_OWNED' })
})

test('ownership: close only reduces the owned quantity, leaving the foreign portion intact', () => {
  const result = evaluateRisk({
    action: 'CLOSE', direction: 'SHORT', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.001, availableQuantity: 0.001,
      entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [{ symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0003 }],
  })
  assert.equal(result.reduceOnly, true)
  assert.equal(result.side, 'BUY')
  assert.equal(result.quantity, 0.0003)
})

test('ownership: open is refused when a foreign opposite position exists', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'BTC-USDT', direction: 'SHORT', quantity: 0.0002, availableQuantity: 0.0002,
      entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [],
  }), { code: 'RISK_FOREIGN_OPPOSITE_POSITION' })
})

test('ownership: open ignores a foreign same-direction position (limit counts only owned)', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 40_000,
    sizingCapitalUsd: 100, availableMargin: 100, rules, policy, ordersLastMinute: 0,
    realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    positions: [{
      symbol: 'BTC-USDT', direction: 'LONG', quantity: 0.001, availableQuantity: 0.001,
      entryPrice: 40_000, markPrice: 40_000, leverage: 1, unrealizedPnl: 0,
    }],
    ownedPositions: [],
  })
  assert.equal(result.reduceOnly, false)
  assert.equal(result.quantity, 0.0002)
})

test('compound sizing recalculates from the equity of each account', () => {
  const compoundPolicy: RiskPolicy = {
    ...policy,
    sizingMode: 'EQUITY_PERCENT',
    exposurePerOrderPct: 5,
    maxTotalExposurePct: 10,
    marginReservePct: 60,
    dailyLossLimitPct: 2,
  }
  const evaluate = (sizingCapitalUsd: number) => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100,
    sizingCapitalUsd, availableMargin: sizingCapitalUsd, positions: [], ownedPositions: [],
    rules: { ...rules, quantityStep: 0.001, quantityPrecision: 3 },
    policy: compoundPolicy, ordersLastMinute: 0, realizedPnlTodayUsd: 0,
    connectionStatus: 'ACTIVE',
  })

  assert.equal(evaluate(150).notionalUsd, 7.5)
  assert.equal(evaluate(300).notionalUsd, 15)
  assert.equal(evaluate(1_000).notionalUsd, 50)
  assert.equal(evaluate(1_030).notionalUsd, 51.5)
})

test('full balance sizing opens with what the account has instead of rejecting for cents', () => {
  const fullBalance: RiskPolicy = {
    ...policy, sizingMode: 'EQUITY_PERCENT', exposurePerOrderPct: 100, maxTotalExposurePct: 100,
    marginReservePct: 0, dailyLossLimitPct: 100, declaredCapitalUsd: 1_000_000,
  }
  // 10 USD en Bitunix (taker 0,06%) a 1x con BTC a 81.192,5: entra 0,0001 BTC.
  const bitunix = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 81_192.5,
    sizingCapitalUsd: 10, availableMargin: 10, positions: [], ownedPositions: [],
    rules, policy: fullBalance, openingFeeRate: 0.0006,
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })
  assert.equal(bitunix.quantity, 0.0001)
  assert.ok(bitunix.notionalUsd <= 10 && bitunix.notionalUsd > 9.9)
  // El mismo modo en BingX (taker 0,05%): la exposición es el saldo; 2x sólo reduce el margen.
  const bingx = evaluateRisk({
    action: 'OPEN', direction: 'SHORT', symbol: 'BTC-USDT', price: 81_192.5,
    sizingCapitalUsd: 250, availableMargin: 250, positions: [], ownedPositions: [],
    rules: { ...rules, maximumShortLeverage: 125 }, policy: { ...fullBalance, maxLeverage: 2 }, openingFeeRate: 0.0005,
    ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })
  assert.equal(bingx.notionalUsd, 250)
  assert.equal(bingx.leverage, 2)
})

test('full balance sizing below the instrument lot rejects as insufficient funds', () => {
  assert.throws(() => evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 81_192.5,
    sizingCapitalUsd: 7, availableMargin: 7, positions: [], ownedPositions: [], rules,
    policy: { ...policy, sizingMode: 'EQUITY_PERCENT', exposurePerOrderPct: 100, maxTotalExposurePct: 100, marginReservePct: 0, dailyLossLimitPct: 100 },
    openingFeeRate: 0.0006, ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  }), { code: 'RISK_MARGIN_RESERVE' })
})

test('percent sizing keeps its reserve when the balance trims the entry', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100,
    sizingCapitalUsd: 110, availableMargin: 110, positions: [], ownedPositions: [],
    rules: { ...rules, quantityStep: 0.001, quantityPrecision: 3 },
    policy: { ...policy, sizingMode: 'EQUITY_PERCENT', exposurePerOrderPct: 90, maxTotalExposurePct: 100, marginReservePct: 10, dailyLossLimitPct: 2 },
    openingFeeRate: 0.0005, ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
  })
  // 90% de 110 = 99 USD no entra con 11 USD de reserva y la comisión: se recorta sin tocar la reserva.
  assert.ok(result.notionalUsd < 99 && result.notionalUsd >= 98.9)
})

test('the displayed 100 percent no-cut setting really disables the daily cut, even after a withdrawal', () => {
  const result = evaluateRisk({
    action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100,
    sizingCapitalUsd: 100, availableMargin: 100, positions: [], ownedPositions: [], rules,
    policy: { ...policy, sizingMode: 'EQUITY_PERCENT', exposurePerOrderPct: 50, maxTotalExposurePct: 100, dailyLossLimitPct: 100, marginReservePct: 0 },
    ordersLastMinute: 0, realizedPnlTodayUsd: -150, connectionStatus: 'ACTIVE',
  })
  assert.equal(result.notionalUsd, 50)
})

test('the reported user case remains protected by its chosen 2 percent daily cut at every entry allocation', () => {
  for (const allocation of [50, 70, 100]) {
    assert.throws(() => evaluateRisk({
      action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100000,
      sizingCapitalUsd: 197.8199, availableMargin: 197.8199, positions: [], ownedPositions: [], rules,
      policy: { ...policy, sizingMode: 'EQUITY_PERCENT', declaredCapitalUsd: 1000000, fixedNotionalUsd: 1000000 * allocation / 100, exposurePerOrderPct: allocation, maxTotalExposurePct: 100, dailyLossLimitPct: 2, marginReservePct: 0 },
      ordersLastMinute: 0, realizedPnlTodayUsd: -3.965186, connectionStatus: 'ACTIVE',
    }), (error: unknown) => {
      assert.equal((error as {code: string}).code, 'RISK_DAILY_LOSS_LIMIT')
      assert.match((error as Error).message, /2%/)
      assert.match((error as Error).message, /3\.97/)
      assert.match((error as Error).message, /3\.96/)
      return true
    })
  }
})


test('edit previews use equity plus connection PnL, then constrain by free margin exactly as the engine', () => {
  const cases = [
    { capital: 1000000, pnl: 0, equity: 200, free: 100, expectedCapital: 200 },
    { capital: 150, pnl: 20, equity: 200, free: 200, expectedCapital: 170 },
    { capital: 150, pnl: -20, equity: 200, free: 200, expectedCapital: 130 },
    { capital: 150, pnl: 80, equity: 200, free: 200, expectedCapital: 200 },
  ]
  for (const c of cases) {
    const editedPolicy = { ...policy, sizingMode: 'EQUITY_PERCENT' as const, declaredCapitalUsd: c.capital, exposurePerOrderPct: 50, maxTotalExposurePct: 100, dailyLossLimitPct: 100, marginReservePct: 0 }
    const sizingCapitalUsd = managedSizingCapitalUsd(c.capital, c.pnl, c.equity)
    assert.equal(sizingCapitalUsd, c.expectedCapital)
    const preview = planOpeningNotional({ policy: editedPolicy, sizingCapitalUsd, availableMarginUsd: c.free, takerFeeRate: 0.0005 })
    const approved = evaluateRisk({
      action: 'OPEN', direction: 'LONG', symbol: 'BTC-USDT', price: 100,
      sizingCapitalUsd, availableMargin: c.free, positions: [], ownedPositions: [], rules,
      policy: editedPolicy, openingFeeRate: 0.0005, ordersLastMinute: 0, realizedPnlTodayUsd: 0, connectionStatus: 'ACTIVE',
    })
    assert.equal(preview.notionalUsd, approved.notionalUsd)
    if (c.free === 100) assert.ok(preview.notionalUsd > 99 && preview.notionalUsd < 100)
  }
})
