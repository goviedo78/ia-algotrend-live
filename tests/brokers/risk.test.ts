import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateRisk } from '../../src/lib/brokers/risk'
import type { RiskPolicy } from '../../src/lib/brokers/domain'

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
