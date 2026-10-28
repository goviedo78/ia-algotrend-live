import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOpeningFundingRequirement, planOpeningFunding } from '../../src/lib/brokers/funding-requirement'

const base = { targetNotionalUsd: 90, leverage: 1, reserveUsd: 10, takerFeeRate: 0.0005 }

test('fixed amount stays exact even when there is not enough free balance', () => {
  const plan = planOpeningFunding({ ...base, availableMarginUsd: 100 })
  assert.equal(plan.targetNotionalUsd, 90)
  assert.equal(plan.requiredAvailableMarginUsd, 100.05)
  assert.equal(plan.adjustedForFunding, false)
})

test('compound budgets fit independently, preserve the reserve, and never exceed the target', () => {
  for (const capital of [0.01, 100, 150, 197.008219, 300, 1_000, 100_000]) {
    for (const leverage of [1, 2, 20]) {
      for (const allocation of [5, 90, 100]) {
        for (const fee of [0, 0.0005, 0.002]) {
          const reserveUsd = capital * 0.1
          const plan = planOpeningFunding({
            targetNotionalUsd: capital * allocation / 100, leverage, reserveUsd,
            takerFeeRate: fee, compoundCapitalUsd: capital, availableMarginUsd: capital,
          })
          assert.ok(plan.targetNotionalUsd <= plan.configuredNotionalUsd)
          assert.ok(plan.reserveUsd >= reserveUsd)
          if (plan.targetNotionalUsd > 0) assert.ok(plan.requiredAvailableMarginUsd <= capital)
          if (plan.adjustedForFunding && plan.targetNotionalUsd + 0.01 <= plan.configuredNotionalUsd) {
            assert.ok(calculateOpeningFundingRequirement({
              notionalUsd: plan.targetNotionalUsd + 0.01, leverage, reserveUsd, takerFeeRate: fee,
            }).requiredAvailableMarginUsd > capital)
          }
        }
      }
    }
  }
})

test('real free margin caps compound size and never consumes protected funds', () => {
  const plan = planOpeningFunding({ ...base, compoundCapitalUsd: 100, availableMarginUsd: 60 })
  assert.equal(plan.targetNotionalUsd, 49.97)
  assert.equal(plan.reserveUsd, 10)
  assert.equal(plan.requiredAvailableMarginUsd, 60)
  assert.equal(planOpeningFunding({ ...base, compoundCapitalUsd: 100, availableMarginUsd: 9 }).targetNotionalUsd, 0)
})

test('extra broker equity cannot inflate the authorized compound capital', () => {
  const plan = planOpeningFunding({ ...base, compoundCapitalUsd: 100, availableMarginUsd: 100_000 })
  assert.equal(plan.targetNotionalUsd, 89.95)
})

test('invalid funding inputs never produce an apparently funded order', () => {
  for (const value of [NaN, Infinity, -1]) {
    assert.throws(() => planOpeningFunding({ ...base, takerFeeRate: value }), { code: 'RISK_COMMISSION_RATE_INVALID' })
    assert.throws(() => planOpeningFunding({ ...base, compoundCapitalUsd: value }), { code: 'RISK_LIMITS_NOT_CONFIGURED' })
    assert.throws(() => planOpeningFunding({ ...base, availableMarginUsd: value }), { code: 'RISK_LIMITS_NOT_CONFIGURED' })
  }
})
