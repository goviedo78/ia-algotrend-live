import test from 'node:test'
import assert from 'node:assert/strict'
import { getSafeRedirectPath } from '../../src/lib/safe-redirect'

test('broker auth only returns to approved internal routes', () => {
  assert.equal(getSafeRedirectPath('/cuenta/conexiones', '/account'), '/cuenta/conexiones')
  assert.equal(
    getSafeRedirectPath('/cuenta/seguridad?next=/admin/conexiones', '/account'),
    '/cuenta/seguridad?next=/admin/conexiones',
  )
})

test('broker auth rejects external and malformed return targets', () => {
  assert.equal(getSafeRedirectPath('//attacker.example', '/account'), '/account')
  assert.equal(getSafeRedirectPath('/\\attacker.example', '/account'), '/account')
  assert.equal(getSafeRedirectPath('/official', '/account'), '/account')
})
