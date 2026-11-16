import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('keepalive only performs read-only balance calls', async () => {
  const source = await readFile(path.join(root, 'src/lib/brokers/keepalive.ts'), 'utf8')
  assert.match(source, /getBalance\(\)/)
  for (const forbidden of ['placeMarketOrder', 'setLeverage', "status: '"]) {
    assert.equal(source.includes(forbidden), false, `keepalive must not use ${forbidden}`)
  }
  assert.match(source, /'DELETED', 'REVOKED', 'REJECTED'/)
})

test('keepalive route requires the broker drain secret', async () => {
  const source = await readFile(path.join(root, 'src/app/api/cron/broker-keepalive/route.ts'), 'utf8')
  assert.match(source, /BROKER_DRAIN_SECRET/)
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /status: 401/)
})
