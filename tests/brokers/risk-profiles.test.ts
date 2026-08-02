import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveRiskSuggestion } from '../../src/lib/brokers/risk-profiles'
import { connectionCreateSchema } from '../../src/lib/brokers/schemas'

test('the default order uses the full amount explicitly authorized by the user', () => {
  assert.deepEqual(deriveRiskSuggestion(100, 'CONSERVATIVE'), {
    declaredCapitalUsd: 100,
    riskProfile: 'CONSERVATIVE',
    exposurePerOrderPct: 100,
    maxTotalExposurePct: 100,
    dailyLossLimitPct: 2,
    marginReservePct: 0,
    suggestedNotionalPerOrderUsd: 100,
    suggestedMaxTotalExposureUsd: 100,
    suggestedDailyLossLimitUsd: 2,
    suggestedMinAvailableMarginUsd: 0,
  })
})

test('suggestions scale in USD without creating asset-specific lots', () => {
  const result = deriveRiskSuggestion(250, 'ULTRA_CONSERVATIVE')
  assert.equal(result.suggestedNotionalPerOrderUsd, 250)
  assert.equal(result.suggestedMaxTotalExposureUsd, 250)
  assert.equal(result.suggestedMinAvailableMarginUsd, 0)
})

test('a custom per-account allocation is capped and drives the proposal', () => {
  const result = deriveRiskSuggestion(1_000, 'CONSERVATIVE', 12.5)
  assert.equal(result.exposurePerOrderPct, 12.5)
  assert.equal(result.suggestedNotionalPerOrderUsd, 125)
  assert.equal(result.maxTotalExposurePct, 12.5)
  assert.equal(result.suggestedMaxTotalExposureUsd, 125)
  assert.equal(deriveRiskSuggestion(1_000, 'MODERATE', 100).exposurePerOrderPct, 100)
})

test('connection input defaults to the full user-authorized amount', () => {
  const parsed = connectionCreateSchema.parse({
    broker: 'BINGX',
    environment: 'DEMO',
    strategyCode: 'ALGOTREND_BTC_1H',
    label: 'Cuenta de prueba',
    capitalUsd: 1_000,
    riskProfile: 'CONSERVATIVE',
    apiKey: 'a'.repeat(16),
    secretKey: 'b'.repeat(16),
    permissions: {
      read: true,
      perpetualTrading: true,
      spot: false,
      withdrawal: false,
      universalTransfer: false,
      subaccounts: false,
      p2p: false,
    },
  })

  assert.equal(parsed.allocationPct, 100)
  assert.equal(deriveRiskSuggestion(parsed.capitalUsd, parsed.riskProfile, parsed.allocationPct).suggestedNotionalPerOrderUsd, 1_000)
})
