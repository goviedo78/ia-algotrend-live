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

test('approved connections apply serialized self-service risk edits without a second approval', async () => {
  const [migration, selfServiceMigration, riskRoute, lifecycle, panel] = await Promise.all([
    readFile(path.join(root, 'supabase/migrations/20260718210034_safe_existing_connection_edits.sql'), 'utf8'),
    readFile(path.join(root, 'supabase/migrations/20260802103000_auto_approve_risk_edits_for_existing_connections.sql'), 'utf8'),
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
  assert.match(riskRoute, /request_broker_risk_change/)
  assert.match(selfServiceMigration, /is_already_approved := connection_record\.approved_at is not null/i)
  assert.match(selfServiceMigration, /if is_already_approved then[\s\S]*set status = 'ACTIVE'/i)
  assert.match(selfServiceMigration, /connection has pending execution jobs/i)
  assert.match(selfServiceMigration, /grant execute on function public\.request_broker_risk_change[\s\S]*service_role/i)
  assert.match(panel, /title="Editar capital"/)
  assert.match(panel, /declaredCapitalUsd/)
  assert.match(panel, /Guardar cambios/)
})

test('self-service lot and daily loss are uncapped by the platform and never starve their own limits', async () => {
  const [riskRoute, schemas, panel] = await Promise.all([
    readFile(path.join(root, 'src/app/api/broker-connections/[id]/risk/route.ts'), 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/schemas.ts'), 'utf8'),
    readFile(path.join(root, 'src/components/brokers/BrokerConnectionsPanel.tsx'), 'utf8'),
  ])

  // El lotaje elegido por el titular nunca puede quedar por encima de la exposición total
  // enviada a la RPC: la función rechaza max_total_exposure_usd < notional_per_order_usd.
  // El titular puede fijar la exposición a mano; cuando no la manda, el respaldo derivado
  // nunca puede quedar por debajo de una sola orden.
  assert.match(riskRoute, /Math\.max\(suggestion\.suggestedMaxTotalExposureUsd, fixedNotionalUsd\)/)
  assert.match(riskRoute, /proposal_max_total_exposure_usd: maxTotalExposureUsd/)
  // La reserva de margen no puede solaparse con la orden autorizada.
  assert.match(riskRoute, /Math\.max\(0, Math\.min\(suggestion\.suggestedMinAvailableMarginUsd, suggestion\.declaredCapitalUsd - fixedNotionalUsd\)\)/)
  assert.match(riskRoute, /proposal_min_available_margin_usd: minAvailableMarginUsd/)
  // Decisión de producto: el titular configura el riesgo que quiera. La plataforma no impone
  // un techo propio sobre el lotaje ni sobre la pérdida diaria; el límite real es el margen del
  // broker. Nadie debe reintroducir una validación de "no puede superar el capital".
  assert.doesNotMatch(riskRoute, /fixedNotionalUsd > suggestion\.declaredCapitalUsd/)
  assert.doesNotMatch(riskRoute, /dailyLossLimitUsd > suggestion\.declaredCapitalUsd/)
  assert.match(schemas, /fixedNotionalUsd: z\.number\(\)\.positive\(\)\.max\(10_000_000\)\.optional\(\)/)
  assert.match(schemas, /dailyLossLimitUsd: z\.number\(\)\.positive\(\)\.max\(10_000_000\)\.optional\(\)/)
  // La auditoría registra los montos que efectivamente cambiaron.
  assert.match(riskRoute, /notionalPerOrderUsd: fixedNotionalUsd/)
  assert.match(riskRoute, /dailyLossLimitUsd, maxTotalExposureUsd, minAvailableMarginUsd/)
  // Perfil y tope porcentual siguen siendo obligatorios: un default silencioso escalaría el riesgo.
  assert.match(schemas, /riskProfile: z\.enum\(\['ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE'\]\),/)
  assert.match(schemas, /allocationPct: z\.number\(\)\.min\(1\)\.max\(100\),/)
  assert.doesNotMatch(schemas, /allocationPct: z\.number\(\)\.min\(1\)\.max\(100\)\.optional\(\)/)
  // En compuesto el motor dimensiona por equity: el resumen no puede mostrar el monto fijo.
  assert.match(panel, /const effectiveNotionalUsd = riskEdit\.compoundEnabled \? editSuggestion\.suggestedNotionalPerOrderUsd : riskEdit\.fixedNotionalUsd/)
  assert.match(panel, /const effectiveDailyLossUsd = riskEdit\.compoundEnabled \? editSuggestion\.suggestedDailyLossLimitUsd : riskEdit\.dailyLossLimitUsd/)
  assert.match(panel, /% del equity real/)
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
