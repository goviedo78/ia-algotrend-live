import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveRiskSuggestion } from '../../src/lib/brokers/risk-profiles'

test('recommended profile for 100 USD never exposes more than 5 USD per order', () => {
  assert.deepEqual(deriveRiskSuggestion(100, 'CONSERVATIVE'), {
    declaredCapitalUsd: 100,
    riskProfile: 'CONSERVATIVE',
    exposurePerOrderPct: 5,
    maxTotalExposurePct: 10,
    dailyLossLimitPct: 2,
    marginReservePct: 60,
    suggestedNotionalPerOrderUsd: 5,
    suggestedMaxTotalExposureUsd: 10,
    suggestedDailyLossLimitUsd: 2,
    suggestedMinAvailableMarginUsd: 60,
  })
})

test('suggestions scale in USD without creating asset-specific lots', () => {
  const result = deriveRiskSuggestion(250, 'ULTRA_CONSERVATIVE')
  assert.equal(result.suggestedNotionalPerOrderUsd, 7.5)
  assert.equal(result.suggestedMaxTotalExposureUsd, 15)
  assert.equal(result.suggestedMinAvailableMarginUsd, 175)
})

test('a custom per-account allocation is capped and drives the proposal', () => {
  const result = deriveRiskSuggestion(1_000, 'CONSERVATIVE', 12.5)
  assert.equal(result.exposurePerOrderPct, 12.5)
  assert.equal(result.suggestedNotionalPerOrderUsd, 125)
  assert.equal(result.maxTotalExposurePct, 12.5)
  assert.equal(result.suggestedMaxTotalExposureUsd, 125)
  assert.equal(deriveRiskSuggestion(1_000, 'MODERATE', 100).exposurePerOrderPct, 20)
})
