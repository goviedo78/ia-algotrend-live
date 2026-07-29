import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { connectionCreateSchema } from '../../src/lib/brokers/schemas'
import { brokerExecutionMode } from '../../src/lib/brokers/runtime'

const root = process.cwd()

test('execution flags tolerate Vercel whitespace without silently disabling orders', () => {
  const previousExecution = process.env.BROKER_EXECUTION_ENABLED
  const previousLive = process.env.BROKER_LIVE_EXECUTION_ENABLED
  const previousLegacy = process.env.BINGX_LEGACY_EXECUTION_ENABLED
  try {
    process.env.BROKER_EXECUTION_ENABLED = ' true\\n'
    process.env.BROKER_LIVE_EXECUTION_ENABLED = 'TRUE\n'
    process.env.BINGX_LEGACY_EXECUTION_ENABLED = 'false'
    assert.deepEqual(brokerExecutionMode(), {
      executionEnabled: true,
      liveExecutionEnabled: true,
      legacyExecutionEnabled: false,
    })
  } finally {
    if (previousExecution === undefined) delete process.env.BROKER_EXECUTION_ENABLED
    else process.env.BROKER_EXECUTION_ENABLED = previousExecution
    if (previousLive === undefined) delete process.env.BROKER_LIVE_EXECUTION_ENABLED
    else process.env.BROKER_LIVE_EXECUTION_ENABLED = previousLive
    if (previousLegacy === undefined) delete process.env.BINGX_LEGACY_EXECUTION_ENABLED
    else process.env.BINGX_LEGACY_EXECUTION_ENABLED = previousLegacy
  }
})

test('connection creation accepts the dynamic app egress model', () => {
  const parsed = connectionCreateSchema.parse({
    broker: 'BINGX',
    environment: 'DEMO',
    strategyCode: 'ALGOTREND_BTC_1H',
    label: 'BingX Demo',
    capitalUsd: 100,
    riskProfile: 'CONSERVATIVE',
    apiKey: 'a'.repeat(32),
    secretKey: 'b'.repeat(32),
    permissions: {
      read: true,
      perpetualTrading: true,
      spot: false,
      withdrawal: false,
      universalTransfer: false,
      subaccounts: false,
      p2p: false,
    },
    ipRestrictionConfirmed: false,
  })

  assert.equal(parsed.ipRestrictionConfirmed, false)
  assert.equal(parsed.strategyCode, 'ALGOTREND_BTC_1H')
})

test('connection approval requires least privilege but not a fixed IP', async () => {
  const [sql, permissionSql] = await Promise.all([
    readFile(path.join(root, 'supabase/migrations/20260717173355_serverless_broker_execution.sql'), 'utf8'),
    readFile(path.join(root, 'supabase/migrations/20260717180120_enforce_broker_least_privilege_permissions.sql'), 'utf8'),
  ])
  assert.match(sql, /permissions_confirmed->>'read'/)
  assert.match(sql, /permissions_confirmed->>'perpetualTrading'/)
  assert.doesNotMatch(sql, /not connection_record\.ip_restriction_confirmed/i)
  assert.match(sql, /grant execute on function public\.approve_broker_connection[\s\S]*service_role/i)
  assert.match(permissionSql, /"spot": false/)
  assert.match(permissionSql, /"withdrawal": false/)
  assert.match(permissionSql, /validate constraint broker_connections_least_privilege_permissions/i)
})

test('AlgoTrend cron dispatches signals and drains jobs inside the app', async () => {
  const source = await readFile(path.join(root, 'src/app/api/cron/check/route.ts'), 'utf8')
  assert.match(source, /dispatchBrokerSignal\(/)
  assert.match(source, /safeProcessBrokerJobsInApp\(/)
  assert.match(source, /strategyCode: 'ALGOTREND_BTC_1H'/)
  assert.match(source, /symbol: 'BTC-USDT'/)
  assert.match(source, /isLegacyBingxEnabled\(\)/)
  assert.match(source, /concurrency: 20/)
  assert.doesNotMatch(source, /fetch\([^)]*broker-signals/i)
})

test('broker routes schedule validation and execution in the Next.js runtime', async () => {
  const routes = [
    'src/app/api/broker-connections/route.ts',
    'src/app/api/broker-connections/[id]/rotate/route.ts',
    'src/app/api/broker-connections/[id]/revalidate/route.ts',
    'src/app/api/broker-signals/route.ts',
  ]
  for (const route of routes) {
    const source = await readFile(path.join(root, route), 'utf8')
    assert.match(source, /after\(/)
    assert.match(source, /safeProcessBrokerJobsInApp\(/)
    assert.doesNotMatch(source, /STATIC_EGRESS|BROKER_EXECUTOR|verifyExecutorEgress/)
  }
})

test('signal fanout is transactional and preserves per-account ordering', async () => {
  const [migration, signalSource, workerSource] = await Promise.all([
    readFile(path.join(root, 'supabase/migrations/20260718044136_optimize_broker_signal_fanout.sql'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/signals.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8'),
  ])
  assert.match(migration, /create or replace function public\.fanout_broker_signal/i)
  assert.match(migration, /insert into public\.broker_order_intents[\s\S]*insert into public\.broker_execution_jobs/i)
  assert.match(migration, /earlier\.connection_id = jobs\.connection_id[\s\S]*earlier\.status in \('QUEUED', 'RETRY', 'PROCESSING'\)/i)
  assert.match(migration, /grant execute on function public\.fanout_broker_signal\(uuid\)[\s\S]*service_role/i)
  assert.match(signalSource, /admin\.rpc\('fanout_broker_signal'/)
  assert.match(workerSource, /processJobsWithConcurrency/)
  assert.match(workerSource, /const groups = new Map<string, Job\[\]>/)
})

test('existing connections edit the same policy through a serialized approval flow', async () => {
  const [migration, riskRoute, lifecycle, panel] = await Promise.all([
    readFile(path.join(root, 'supabase/migrations/20260718210034_safe_existing_connection_edits.sql'), 'utf8'),
    readFile(path.join(root, 'src/app/api/broker-connections/[id]/risk/route.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/connection-lifecycle.ts'), 'utf8'),
    readFile(path.join(root, 'src/components/brokers/BrokerConnectionsPanel.tsx'), 'utf8'),
  ])

  assert.match(migration, /create or replace function public\.suspend_broker_connection_for_edit/i)
  assert.match(migration, /connection_record\.status not in \('ACTIVE', 'SUSPENDED'\)/i)
  assert.match(migration, /jobs\.status in \('QUEUED', 'RETRY', 'PROCESSING'\)/i)
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(target_connection_id::text, 0\)\)/i)
  assert.match(migration, /for locked_connection_id in[\s\S]*pg_advisory_xact_lock/i)
  assert.match(migration, /update public\.broker_strategy_bindings[\s\S]*where connection_id = target_connection_id/i)
  assert.doesNotMatch(migration, /insert into public\.broker_connections/i)
  assert.match(lifecycle, /suspend_broker_connection_for_edit/)
  assert.match(riskRoute, /suspendBrokerConnectionForEdit\(id, user\.id\)[\s\S]*assertBrokerConnectionCanBeConfigured\(id\)[\s\S]*request_broker_risk_change/)
  assert.match(panel, /title="Editar capital"/)
  assert.match(panel, /declaredCapitalUsd/)
  assert.match(panel, /Enviar cambio a aprobación/)
})

test('broker recovery drain is secret-authenticated and bounded', async () => {
  const source = await readFile(path.join(root, 'src/app/api/cron/broker-jobs/route.ts'), 'utf8')
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /x-broker-drain-secret/)
  assert.match(source, /batchSize: 50/)
  assert.match(source, /concurrency: 20/)
  assert.match(source, /timeBudgetMs: 25_000/)
  assert.doesNotMatch(source, /searchParams|authorization/i)
})
