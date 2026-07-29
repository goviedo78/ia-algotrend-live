import assert from 'node:assert/strict'
import test from 'node:test'
import { canDeleteConnection, connectionStatusLabel, CONNECTION_STATUSES } from '../../src/lib/brokers/domain'

test('only terminal connection states can be deleted', () => {
  const deletable = CONNECTION_STATUSES.filter(canDeleteConnection)
  assert.deepEqual(deletable, ['VALIDATION_FAILED', 'REJECTED', 'REVOKED'])
  assert.equal(canDeleteConnection('ACTIVE'), false)
  assert.equal(canDeleteConnection('MANUAL_INTERVENTION_REQUIRED'), false)
})

test('every connection state has a readable label', () => {
  for (const status of CONNECTION_STATUSES) {
    assert.ok(connectionStatusLabel(status).length > 0)
  }
  assert.equal(connectionStatusLabel('MANUAL_INTERVENTION_REQUIRED'), 'Revisión manual requerida')
})
