import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveRiskSuggestion } from '../../src/lib/brokers/risk-profiles'
import { connectionCreateSchema } from '../../src/lib/brokers/schemas'

test('the default rule allocates 90% and keeps a 10% margin reserve', () => {
  assert.deepEqual(deriveRiskSuggestion(100, 'CONSERVATIVE'), {
    declaredCapitalUsd: 100,
    riskProfile: 'CONSERVATIVE',
    exposurePerOrderPct: 90,
    maxTotalExposurePct: 90,
    dailyLossLimitPct: 2,
    marginReservePct: 10,
    suggestedNotionalPerOrderUsd: 90,
    suggestedMaxTotalExposureUsd: 90,
    suggestedDailyLossLimitUsd: 2,
    suggestedMinAvailableMarginUsd: 10,
  })
})

test('suggestions scale in USD without creating asset-specific lots', () => {
  const result = deriveRiskSuggestion(250, 'ULTRA_CONSERVATIVE')
  assert.equal(result.suggestedNotionalPerOrderUsd, 225)
  assert.equal(result.suggestedMaxTotalExposureUsd, 225)
  assert.equal(result.suggestedMinAvailableMarginUsd, 25)
})

test('a custom per-account allocation is capped and drives the proposal', () => {
  const result = deriveRiskSuggestion(1_000, 'CONSERVATIVE', 12.5)
  assert.equal(result.exposurePerOrderPct, 12.5)
  assert.equal(result.suggestedNotionalPerOrderUsd, 125)
  assert.equal(result.maxTotalExposurePct, 12.5)
  assert.equal(result.suggestedMaxTotalExposureUsd, 125)
  assert.equal(deriveRiskSuggestion(1_000, 'MODERATE', 100).exposurePerOrderPct, 100)
})

test('connection input defaults to the general 90/10 allocation rule', () => {
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

  assert.equal(parsed.allocationPct, 90)
  assert.equal(deriveRiskSuggestion(parsed.capitalUsd, parsed.riskProfile, parsed.allocationPct).suggestedNotionalPerOrderUsd, 900)
})
