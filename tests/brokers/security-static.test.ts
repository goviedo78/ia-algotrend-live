import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase/migrations/20260717021312_multi_broker_platform.sql')
const rateLimitMigrationPath = path.join(root, 'supabase/migrations/20260717060000_broker_rate_limits.sql')
const lifecycleMigrationPath = path.join(root, 'supabase/migrations/20260718033808_harden_broker_connection_lifecycle.sql')
const deletedConnectionMigrationPath = path.join(root, 'supabase/migrations/20260718034933_allow_deleted_broker_connections.sql')
const compoundSizingMigrationPath = path.join(root, 'supabase/migrations/20260718184243_account_equity_compound_sizing.sql')
const strategyMigrationPath = path.join(root, 'supabase/migrations/20260718191837_strategy_catalog_admin_edit_gold30_outbox.sql')
const fullAllocationMigrationPath = path.join(root, 'supabase/migrations/20260802020000_allow_full_capital_broker_allocation.sql')

test('every broker table enables RLS in the same migration', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  const tables = [...sql.matchAll(/create table public\.(broker_[a-z_]+)/g)].map((match) => match[1])
  assert.equal(tables.length, 13)
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, 'i'))
  }
})

test('credential envelopes are denied to browser roles', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /revoke all on table public\.broker_credential_envelopes from anon, authenticated;/i)
  assert.doesNotMatch(sql, /grant select on table public\.broker_credential_envelopes to authenticated/i)
})

test('worker claim recovers stale locks and approval requires active membership', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /status = 'PROCESSING'[\s\S]*locked_at < now\(\) - interval '5 minutes'/i)
  assert.match(sql, /broker_memberships membership[\s\S]*membership\.status = 'ACTIVE'/i)
  assert.match(sql, /broker_jobs_intent_type_unique/i)
  assert.match(sql, /approved policy exceeds the user risk proposal/i)
})

test('signal input has no sizing or leverage fields and is strict', async () => {
  const source = await readFile(path.join(root, 'src/lib/brokers/schemas.ts'), 'utf8')
  const signal = source.slice(source.indexOf('export const brokerSignalSchema'))
  assert.match(signal, /\.strict\(\)/)
  assert.doesNotMatch(signal, /quantity|leverage/i)
})

test('connection DTO never maps encrypted credential columns', async () => {
  const source = await readFile(path.join(root, 'src/lib/brokers/dto.ts'), 'utf8')
  assert.doesNotMatch(source, /ciphertext|encrypted_data_key|secret_key|api_key/i)
})

test('worker persists fees and realized PnL with deduplication', async () => {
  const [worker, sql] = await Promise.all([
    readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8'),
    readFile(migrationPath, 'utf8'),
  ])
  assert.match(worker, /entry_type: 'FEE'/)
  assert.match(worker, /entry_type: 'REALIZED_PNL'/)
  assert.match(worker, /const feeUsd = fills\.length[\s\S]*fills\.reduce/)
  assert.match(worker, /ORDER_FILLS_PENDING/)
  // El piso de lo que hay que recuperar es lo que ya persistimos al colocar la orden: guiarse
  // sólo por `remoteOrder.filledQuantity` daba órdenes "reconciliadas" con cero contabilidad.
  assert.match(worker, /fillsQuantity < expectedQuantity - fillTolerance/)
  assert.match(worker, /notional_usd: actualNotionalUsd/)
  assert.doesNotMatch(worker, /brokerFillId:\s*brokerOrderId/)
  assert.match(sql, /unique \(connection_id, entry_type, external_reference\)/i)
})

test('full-capital allocation is enforced consistently and remains service-only', async () => {
  const sql = await readFile(fullAllocationMigrationPath, 'utf8')
  assert.match(sql, /exposure_per_order_pct between 0 and 100/i)
  assert.match(sql, /max_total_exposure_pct between 0 and 100/i)
  assert.match(sql, /proposal_exposure_per_order_pct > 100/i)
  assert.match(sql, /policy_exposure_per_order_pct > 100/i)
  assert.match(sql, /security definer/gi)
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/i)
  assert.match(sql, /revoke all on function public\.request_broker_risk_change[\s\S]*anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.approve_broker_connection[\s\S]*service_role/i)
})

test('database rate limiter is service-only and protected by RLS', async () => {
  const [sql, source] = await Promise.all([
    readFile(rateLimitMigrationPath, 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/rate-limit.ts'), 'utf8'),
  ])
  assert.match(sql, /alter table public\.broker_rate_limit_buckets enable row level security;/i)
  assert.match(sql, /revoke all on function public\.consume_broker_rate_limit[\s\S]*anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.consume_broker_rate_limit[\s\S]*service_role/i)
  assert.match(source, /createHmac\('sha256'/)
  assert.match(source, /admin\.rpc\('consume_broker_rate_limit'/)
})

test('connection revocation and deletion destroy credentials atomically', async () => {
  const [sql, deletedSql, lifecycle, userRoute, adminRoute] = await Promise.all([
    readFile(lifecycleMigrationPath, 'utf8'),
    readFile(deletedConnectionMigrationPath, 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/connection-lifecycle.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/api/broker-connections/[id]/route.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/api/admin/broker-connections/[id]/route.ts'), 'utf8'),
  ])
  assert.match(sql, /create or replace function public\.finalize_broker_connection_revocation/i)
  assert.match(sql, /create or replace function public\.soft_delete_broker_connection/i)
  assert.match(sql, /delete from public\.broker_credential_envelopes[\s\S]*return final_status/i)
  assert.match(sql, /revoke all on function public\.finalize_broker_connection_revocation[\s\S]*anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.soft_delete_broker_connection[\s\S]*service_role/i)
  assert.match(deletedSql, /status = 'DELETED'[\s\S]*or permissions_confirmed @>/i)
  assert.match(lifecycle, /adapter\.getPositions\(\)/)
  assert.match(lifecycle, /requestedStatus = 'MANUAL_INTERVENTION_REQUIRED'/)
  assert.match(userRoute, /revokeBrokerConnection\(connection\)/)
  assert.match(adminRoute, /softDeleteBrokerConnection\(id, connection\.user_id\)/)
})

test('every sensitive JSON route uses the bounded body reader', async () => {
  const routePaths = [
    'src/app/api/broker-connections/route.ts',
    'src/app/api/broker-connections/[id]/route.ts',
    'src/app/api/broker-connections/[id]/rotate/route.ts',
    'src/app/api/admin/broker-connections/[id]/route.ts',
    'src/app/api/admin/broker-memberships/[userId]/route.ts',
    'src/app/api/broker-signals/route.ts',
  ]
  for (const routePath of routePaths) {
    const source = await readFile(path.join(root, routePath), 'utf8')
    assert.match(source, /readBroker(?:Raw)?Json\(request/)
    assert.doesNotMatch(source, /request\.(?:json|text)\(/)
  }
})

test('compound sizing runtime is connection-scoped and service-only', async () => {
  const [sql, worker] = await Promise.all([
    readFile(compoundSizingMigrationPath, 'utf8'),
    readFile(path.join(root, 'src/lib/brokers/worker.ts'), 'utf8'),
  ])
  assert.match(sql, /sizing_mode in \('FIXED_NOTIONAL', 'EQUITY_PERCENT'\)/i)
  assert.match(sql, /exposure_per_order_pct between 0 and 20/i)
  assert.match(sql, /ledger\.connection_id = policy\.connection_id/i)
  assert.match(sql, /entry_type in \('REALIZED_PNL', 'FEE'\)/i)
  assert.match(sql, /revoke all on function public\.get_broker_risk_runtime\(uuid\)[\s\S]*anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.get_broker_risk_runtime\(uuid\)[\s\S]*service_role/i)
  assert.match(worker, /Math\.min\([\s\S]*balance\.equity[\s\S]*compound_capital_usd/i)
})

test('gold strategy is connection-scoped and its outbox is deny-all to browser roles', async () => {
  const sql = await readFile(strategyMigrationPath, 'utf8')
  assert.match(sql, /ALGOTREND_GOLD_30M/)
  assert.match(sql, /NCCOGOLD2USD-USDT/)
  assert.match(sql, /alter table public\.gold30_broker_outbox enable row level security/i)
  assert.match(sql, /revoke all on table public\.gold30_broker_outbox from anon, authenticated/i)
  assert.match(sql, /binding does not match the requested strategy/i)
  assert.match(sql, /prepare_broker_connection_edit/i)
})
