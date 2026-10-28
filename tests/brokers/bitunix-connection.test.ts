import assert from 'node:assert/strict'
import test from 'node:test'
import { connectionCreateSchema } from '../../src/lib/brokers/schemas'
import { createBrokerAdapter } from '../../src/lib/brokers/adapters/registry'

const input = {
  broker: 'BITUNIX', environment: 'LIVE', strategyCode: 'ALGOTREND_BTC_1H',
  label: 'Bitunix alternativa', capitalUsd: 100, riskProfile: 'CONSERVATIVE',
  apiKey: 'test-api-key-not-a-real-credential', secretKey: 'test-secret-not-a-real-credential',
  permissions: { read: true, perpetualTrading: true, spot: false, withdrawal: false, universalTransfer: false, subaccounts: false, p2p: false },
}

test('Bitunix accepts an independent LIVE connection without requiring an IP', () => {
  const parsed = connectionCreateSchema.parse(input)
  assert.equal(parsed.ipRestrictionConfirmed, false)
  assert.equal(createBrokerAdapter(parsed.broker, { credentials: parsed, environment: parsed.environment }).broker, 'BITUNIX')
})

test('Bitunix DEMO is rejected instead of routing simulated funds to a live account', () => {
  assert.equal(connectionCreateSchema.safeParse({ ...input, environment: 'DEMO' }).success, false)
  assert.equal(connectionCreateSchema.safeParse({ ...input, strategyCode: 'ALGOTREND_GOLD_30M' }).success, false)
})

test('BingX demo and real factories remain independent of Bitunix', () => {
  for (const environment of ['DEMO', 'LIVE'] as const) {
    const parsed = connectionCreateSchema.parse({ ...input, broker: 'BINGX', environment })
    assert.equal(createBrokerAdapter(parsed.broker, { credentials: parsed, environment }).broker, 'BINGX')
  }
  assert.equal(connectionCreateSchema.safeParse({ ...input, permissions: { ...input.permissions, withdrawal: true } }).success, false)
})
