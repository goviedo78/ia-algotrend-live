import 'server-only'

import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BrokerAdapter, BrokerOrderResult } from './adapters/types'
import { loadBrokerAdapter } from './adapter-loader'
import { writeBrokerAudit } from './audit'
import { riskPolicyFromRow } from './dto'
import { BrokerPlatformError } from './errors'
import { evaluateRisk, type OwnedPosition } from './risk'
import { normalizeSymbol } from './domain'
import { brokerExecutionMode } from './runtime'

type Job = {
  id: string
  connection_id: string
  intent_id: string | null
  job_type: 'VALIDATE_CONNECTION' | 'EXECUTE_ORDER' | 'RECONCILE_ORDER'
  attempts: number
  max_attempts: number
  created_at: string
}

type RunnerOptions = {
  batchSize?: number
  maxBatches?: number
  concurrency?: number
  timeBudgetMs?: number
  idlePollMs?: number
  maxIdlePolls?: number
}

function errorCode(error: unknown) {
  return error instanceof BrokerPlatformError ? error.code : 'WORKER_INTERNAL_ERROR'
}

async function completeJob(jobId: string) {
  const { error } = await createAdminClient().from('broker_execution_jobs').update({
    status: 'COMPLETED', locked_at: null, locked_by: null, last_error_code: null,
  }).eq('id', jobId)
  if (error) throw error
}

async function enqueueReconciliation(connectionId: string, intentId: string) {
  const { error } = await createAdminClient().from('broker_execution_jobs').insert({
    connection_id: connectionId,
    intent_id: intentId,
    job_type: 'RECONCILE_ORDER',
    available_at: new Date(Date.now() + 2_000).toISOString(),
  })
  if (error && error.code !== '23505') throw error
}

async function failJob(job: Job, error: unknown) {
  const retryable = error instanceof BrokerPlatformError && error.retryable
  const terminal = !retryable || job.attempts >= job.max_attempts
  await createAdminClient().from('broker_execution_jobs').update({
    status: terminal ? (retryable ? 'DEAD_LETTER' : 'FAILED') : 'RETRY',
    available_at: terminal ? new Date().toISOString() : new Date(Date.now() + Math.min(300_000, 5_000 * (2 ** job.attempts))).toISOString(),
    locked_at: null,
    locked_by: null,
    last_error_code: errorCode(error),
  }).eq('id', job.id)
}

async function validateConnection(job: Job) {
  const admin = createAdminClient()
  try {
    const { connection, adapter } = await loadBrokerAdapter(job.connection_id)
    const validation = await adapter.validateCredentials()
    await admin.from('broker_connections').update({
      status: 'PENDING_APPROVAL',
      validated_at: new Date().toISOString(),
      last_health_check_at: new Date().toISOString(),
      last_error_code: null,
      account_reference: validation.accountReference,
    }).eq('id', job.connection_id).in('status', ['PENDING_VALIDATION', 'VALIDATION_FAILED'])
    await writeBrokerAudit({ userId: connection.user_id, connectionId: job.connection_id, eventType: 'CONNECTION_VALIDATED', outcome: 'SUCCESS' })
    await completeJob(job.id)
  } catch (error) {
    const willRetry = error instanceof BrokerPlatformError && error.retryable && job.attempts < job.max_attempts
    await admin.from('broker_connections').update({
      status: willRetry ? 'PENDING_VALIDATION' : 'VALIDATION_FAILED',
      last_health_check_at: new Date().toISOString(),
      last_error_code: errorCode(error),
    }).eq('id', job.connection_id)
    await writeBrokerAudit({ connectionId: job.connection_id, eventType: 'CONNECTION_VALIDATION_FAILED', outcome: 'FAILED', metadata: { code: errorCode(error) } })
    await failJob(job, error)
  }
}

async function reconcileAmbiguousOrder(adapter: BrokerAdapter, symbol: string, clientOrderId: string) {
  try {
    return await adapter.getOrder(symbol, clientOrderId)
  } catch {
    return null
  }
}

async function persistOrder(input: {
  result: BrokerOrderResult
  intent: Record<string, unknown>
  approved: ReturnType<typeof evaluateRisk>
}) {
  const admin = createAdminClient()
  const { result, intent, approved } = input
  const { error } = await admin.from('broker_orders').upsert({
    user_id: intent.user_id,
    connection_id: intent.connection_id,
    intent_id: intent.id,
    broker_order_id: result.brokerOrderId,
    client_order_id: result.clientOrderId,
    symbol: approved.symbol,
    side: approved.side,
    position_side: approved.direction,
    reduce_only: approved.reduceOnly,
    requested_quantity: approved.quantity,
    filled_quantity: result.filledQuantity,
    average_price: result.averagePrice,
    notional_usd: approved.notionalUsd,
    status: result.status,
    submitted_at: new Date().toISOString(),
    raw_status: result.rawStatus,
  }, { onConflict: 'intent_id' })
  if (error) throw error
  await admin.from('broker_order_intents').update({
    status: result.status === 'FILLED' ? 'FILLED' : 'SUBMITTED',
  }).eq('id', intent.id)
}

async function persistPositionSnapshots(
  userId: string,
  connectionId: string,
  positions: Awaited<ReturnType<BrokerAdapter['getPositions']>>,
) {
  const admin = createAdminClient()
  const { data: previous } = await admin
    .from('broker_position_snapshots')
    .select('symbol, position_side, quantity')
    .eq('connection_id', connectionId)
    .order('captured_at', { ascending: false })
    .limit(500)
  const previousLatest = new Map<string, { symbol: string; position_side: string; quantity: number }>()
  for (const row of previous ?? []) {
    const key = `${row.symbol}:${row.position_side}`
    if (!previousLatest.has(key)) previousLatest.set(key, row)
  }
  const currentKeys = new Set(positions.map((position) => `${position.symbol}:${position.direction}`))
  const rows = positions.map((position) => ({
    user_id: userId,
    connection_id: connectionId,
    symbol: position.symbol,
    position_side: position.direction,
    quantity: position.quantity,
    entry_price: position.entryPrice,
    mark_price: position.markPrice,
    leverage: position.leverage,
    unrealized_pnl_usd: position.unrealizedPnl,
  }))
  for (const [key, prior] of previousLatest) {
    if (!currentKeys.has(key) && Math.abs(Number(prior.quantity)) > 0) {
      rows.push({
        user_id: userId,
        connection_id: connectionId,
        symbol: prior.symbol,
        position_side: prior.position_side as 'LONG' | 'SHORT',
        quantity: 0,
        entry_price: 0,
        mark_price: 0,
        leverage: 1,
        unrealized_pnl_usd: 0,
      })
    }
  }
  if (rows.length) {
    const { error } = await admin.from('broker_position_snapshots').insert(rows)
    if (error) throw error
  }
}

// Deriva las posiciones que ESTA conexión abrió, desde su propio historial de órdenes:
// Σ filled(apertura) − Σ filled(cierre) por (símbolo, lado). Base de la regla permanente de
// ownership: el motor solo gestiona/cierra lo que la conexión abrió, nunca posiciones ajenas.
async function computeOwnedPositions(connectionId: string): Promise<OwnedPosition[]> {
  const { data, error } = await createAdminClient()
    .from('broker_orders')
    .select('symbol, position_side, reduce_only, filled_quantity')
    .eq('connection_id', connectionId)
  if (error) throw error
  const totals = new Map<string, OwnedPosition>()
  for (const row of data ?? []) {
    const direction = row.position_side === 'SHORT' ? 'SHORT' : 'LONG'
    const symbol = normalizeSymbol(String(row.symbol))
    const key = `${symbol}:${direction}`
    const filled = Number(row.filled_quantity) || 0
    const entry = totals.get(key) ?? { symbol, direction, quantity: 0 }
    entry.quantity += row.reduce_only ? -filled : filled
    totals.set(key, entry)
  }
  return Array.from(totals.values()).filter((entry) => entry.quantity > 1e-12)
}

async function executeOrder(job: Job) {
  const executionStartedAt = Date.now()
  const admin = createAdminClient()
  const executionMode = brokerExecutionMode()
  if (!executionMode.executionEnabled) {
    throw new BrokerPlatformError('EXECUTION_DISABLED', 'La ejecución está desactivada.', 503, true)
  }
  const { data: intent, error: intentError } = await admin
    .from('broker_order_intents')
    .select('*')
    .eq('id', job.intent_id)
    .maybeSingle()
  if (intentError || !intent) throw new BrokerPlatformError('INTENT_NOT_FOUND', 'Intención no encontrada.', 404)
  if (['SUBMITTED', 'PARTIALLY_FILLED', 'FILLED'].includes(intent.status)) {
    await enqueueReconciliation(intent.connection_id, intent.id)
    await completeJob(job.id)
    return
  }

  const { connection, adapter } = await loadBrokerAdapter(job.connection_id)
  if (connection.environment === 'LIVE' && !executionMode.liveExecutionEnabled) {
    throw new BrokerPlatformError('LIVE_EXECUTION_DISABLED', 'La ejecución real está desactivada.', 503, true)
  }
  const { data: policyRow } = await admin.from('broker_risk_policies').select('*').eq('connection_id', connection.id).maybeSingle()
  const policy = riskPolicyFromRow(policyRow)
  if (!policy || policy.version !== intent.policy_version) {
    throw new BrokerPlatformError('RISK_POLICY_VERSION_MISMATCH', 'La política cambió después de crear la orden.', 409)
  }

  const [balance, positions, rules, priceResult, recentOrders, riskRuntime, ownedPositions] = await Promise.all([
    adapter.getBalance(),
    adapter.getPositions(),
    adapter.getInstrumentRules(intent.symbol),
    adapter.getLastPrice(intent.symbol),
    admin.from('broker_orders').select('*', { count: 'exact', head: true }).eq('connection_id', connection.id).gte('created_at', new Date(Date.now() - 60_000).toISOString()),
    admin.rpc('get_broker_risk_runtime', { target_connection_id: connection.id }),
    computeOwnedPositions(connection.id),
  ])
  if (riskRuntime.error) throw riskRuntime.error
  const runtimeRisk = Array.isArray(riskRuntime.data) ? riskRuntime.data[0] : riskRuntime.data
  const compoundCapitalUsd = Math.max(0, Math.min(
    balance.equity,
    Number(runtimeRisk?.compound_capital_usd ?? policy.declaredCapitalUsd),
  ))
  const approved = evaluateRisk({
    action: intent.action,
    direction: intent.direction,
    symbol: intent.symbol,
    price: priceResult,
    sizingCapitalUsd: compoundCapitalUsd,
    availableMargin: balance.availableMargin,
    positions,
    rules,
    policy,
    ordersLastMinute: recentOrders.count ?? 0,
    realizedPnlTodayUsd: Number(runtimeRisk?.daily_net_pnl_usd ?? 0),
    connectionStatus: connection.status,
    ownedPositions,
  })
  await admin.from('broker_order_intents').update({ status: 'SUBMITTING' }).eq('id', intent.id).eq('status', 'QUEUED')

  // A broker lookup is only needed after a retry. The deterministic client ID
  // still protects ambiguous submissions without adding a round trip to every order.
  let result = job.attempts > 1
    ? await adapter.getOrder(approved.symbol, intent.client_order_id)
    : null
  if (!result) {
    if (!approved.reduceOnly) await adapter.setLeverage(approved.symbol, approved.direction, approved.leverage)
    try {
      result = await adapter.placeMarketOrder({ ...approved, clientOrderId: intent.client_order_id })
    } catch (error) {
      const mayAlreadyExist = error instanceof BrokerPlatformError
        && ['BINGX_101400', 'BINGX_101481'].includes(error.code)
      if ((error instanceof BrokerPlatformError && error.retryable) || mayAlreadyExist) {
        result = await reconcileAmbiguousOrder(adapter, approved.symbol, intent.client_order_id)
      }
      if (!result) throw error
    }
  }

  await persistOrder({ result, intent, approved })
  await enqueueReconciliation(connection.id, intent.id)
  await writeBrokerAudit({
    userId: intent.user_id,
    connectionId: connection.id,
    eventType: 'ORDER_SUBMITTED',
    outcome: 'SUCCESS',
    metadata: {
      clientOrderId: intent.client_order_id,
      symbol: approved.symbol,
      reduceOnly: approved.reduceOnly,
      queueLatencyMs: Math.max(0, executionStartedAt - new Date(job.created_at).getTime()),
      executionLatencyMs: Date.now() - executionStartedAt,
    },
  })
  await completeJob(job.id)
}

async function reconcileOrder(job: Job) {
  const admin = createAdminClient()
  const { data: intent } = await admin.from('broker_order_intents').select('*').eq('id', job.intent_id).maybeSingle()
  if (!intent) throw new BrokerPlatformError('INTENT_NOT_FOUND', 'Intención no encontrada.', 404)
  const { data: storedOrder } = await admin.from('broker_orders').select('*').eq('intent_id', intent.id).maybeSingle()
  if (!storedOrder) throw new BrokerPlatformError('ORDER_NOT_PERSISTED', 'La orden todavía no está persistida.', 503, true)
  const { adapter } = await loadBrokerAdapter(job.connection_id)
  const remoteOrder = await adapter.getOrder(storedOrder.symbol, storedOrder.client_order_id)
  if (!remoteOrder) throw new BrokerPlatformError('ORDER_RECONCILIATION_PENDING', 'La orden todavía no está disponible para reconciliar.', 503, true)

  const brokerOrderId = remoteOrder.brokerOrderId ?? storedOrder.broker_order_id
  if (!brokerOrderId) throw new BrokerPlatformError('ORDER_ID_MISSING', 'BingX no devolvió un identificador de orden.', 503, true)
  const fills = await adapter.getOrderFills(storedOrder.symbol, brokerOrderId, new Date(storedOrder.created_at))
  if (fills.length) {
    const fillRows = fills.map((fill) => ({
      user_id: intent.user_id,
      order_id: storedOrder.id,
      broker_fill_id: fill.brokerFillId,
      quantity: fill.quantity,
      price: fill.price,
      fee: Math.abs(fill.fee),
      fee_asset: fill.feeAsset,
      filled_at: fill.filledAt,
    }))
    const { error: fillsError } = await admin.from('broker_fills').upsert(fillRows, { onConflict: 'order_id,broker_fill_id' })
    if (fillsError) throw fillsError

    const ledgerRows = fills.flatMap((fill) => {
      const rows = []
      if (fill.fee !== 0) rows.push({
        user_id: intent.user_id,
        connection_id: intent.connection_id,
        order_id: storedOrder.id,
        entry_type: 'FEE',
        asset: fill.feeAsset,
        amount: -Math.abs(fill.fee),
        amount_usd: fill.feeAsset === 'USDT' ? -Math.abs(fill.fee) : null,
        external_reference: `${fill.brokerFillId}:fee`,
        occurred_at: fill.filledAt,
      })
      if (fill.realizedPnl !== 0) rows.push({
        user_id: intent.user_id,
        connection_id: intent.connection_id,
        order_id: storedOrder.id,
        entry_type: 'REALIZED_PNL',
        asset: 'USDT',
        amount: fill.realizedPnl,
        amount_usd: fill.realizedPnl,
        external_reference: `${fill.brokerFillId}:pnl`,
        occurred_at: fill.filledAt,
      })
      return rows
    })
    if (ledgerRows.length) {
      const { error: ledgerError } = await admin.from('broker_ledger_entries').upsert(ledgerRows, {
        onConflict: 'connection_id,entry_type,external_reference',
      })
      if (ledgerError) throw ledgerError
    }
  }

  const feeUsd = fills.reduce((sum, fill) => sum + (fill.feeAsset === 'USDT' ? Math.abs(fill.fee) : 0), 0)
  const terminal = ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(remoteOrder.status)
  const intentStatus = remoteOrder.status === 'FILLED'
    ? 'FILLED'
    : remoteOrder.status === 'PARTIALLY_FILLED'
      ? 'PARTIALLY_FILLED'
      : ['CANCELED', 'EXPIRED'].includes(remoteOrder.status)
        ? 'CANCELED'
        : remoteOrder.status === 'REJECTED'
          ? 'FAILED'
          : 'SUBMITTED'
  const [{ error: orderError }, { error: intentError }] = await Promise.all([
    admin.from('broker_orders').update({
      broker_order_id: brokerOrderId,
      status: remoteOrder.status,
      filled_quantity: remoteOrder.filledQuantity,
      average_price: remoteOrder.averagePrice,
      fee_usd: feeUsd,
      raw_status: remoteOrder.rawStatus,
      reconciled_at: new Date().toISOString(),
    }).eq('id', storedOrder.id),
    admin.from('broker_order_intents').update({ status: intentStatus }).eq('id', intent.id),
  ])
  if (orderError || intentError) throw orderError || intentError
  if (!terminal) throw new BrokerPlatformError('ORDER_NOT_TERMINAL', 'La orden todavía no está cerrada.', 503, true)
  const freshPositions = await adapter.getPositions()
  await persistPositionSnapshots(intent.user_id, intent.connection_id, freshPositions)
  await completeJob(job.id)
}

export async function processBrokerJob(job: Job) {
  try {
    if (job.job_type === 'VALIDATE_CONNECTION') await validateConnection(job)
    else if (job.job_type === 'RECONCILE_ORDER') await reconcileOrder(job)
    else await executeOrder(job)
  } catch (error) {
    if (job.intent_id && job.job_type === 'EXECUTE_ORDER') {
      const retryable = error instanceof BrokerPlatformError && error.retryable && job.attempts < job.max_attempts
      await createAdminClient().from('broker_order_intents').update({
        status: error instanceof BrokerPlatformError && error.code.startsWith('RISK_')
          ? 'RISK_REJECTED'
          : retryable
            ? (error.code.endsWith('EXECUTION_DISABLED') ? 'QUEUED' : 'UNKNOWN')
            : 'FAILED',
        rejection_code: errorCode(error),
      }).eq('id', job.intent_id)
    }
    await writeBrokerAudit({ connectionId: job.connection_id, eventType: 'EXECUTION_FAILED', outcome: 'FAILED', metadata: { code: errorCode(error) } })
    await failJob(job, error)
  }
}

export async function claimBrokerJobs(workerId: string, batchSize = 10): Promise<Job[]> {
  const { data, error } = await createAdminClient().rpc('claim_broker_execution_jobs', {
    worker_id: workerId,
    batch_size: batchSize,
  })
  if (error) throw error
  return (data ?? []) as Job[]
}

async function processJobsWithConcurrency(jobs: Job[], concurrency: number) {
  const groups = new Map<string, Job[]>()
  for (const job of jobs) {
    const group = groups.get(job.connection_id) ?? []
    group.push(job)
    groups.set(job.connection_id, group)
  }
  const accountJobs = [...groups.values()]
  let nextGroup = 0

  async function runAccountGroups() {
    while (nextGroup < accountJobs.length) {
      const group = accountJobs[nextGroup]
      nextGroup += 1
      for (const job of group) await processBrokerJob(job)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, accountJobs.length) },
      () => runAccountGroups(),
    ),
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function processBrokerJobsInApp(options: RunnerOptions = {}) {
  const batchSize = Math.min(50, Math.max(1, options.batchSize ?? 10))
  const maxBatches = Math.min(20, Math.max(1, options.maxBatches ?? 2))
  const concurrency = Math.min(20, Math.max(1, options.concurrency ?? 5))
  const timeBudgetMs = Math.min(25_000, Math.max(1_000, options.timeBudgetMs ?? 20_000))
  const idlePollMs = Math.min(1_000, Math.max(100, options.idlePollMs ?? 500))
  const maxIdlePolls = Math.min(10, Math.max(0, options.maxIdlePolls ?? 4))
  const runnerId = `app-${randomUUID().slice(0, 12)}`
  const startedAt = Date.now()
  let claimed = 0
  let batches = 0
  let idlePolls = 0
  let handledJobs = false

  while (batches < maxBatches && Date.now() - startedAt < timeBudgetMs) {
    const jobs = await claimBrokerJobs(runnerId, batchSize)
    if (!jobs.length) {
      if (!handledJobs || idlePolls >= maxIdlePolls || Date.now() - startedAt + idlePollMs >= timeBudgetMs) break
      idlePolls += 1
      await sleep(idlePollMs)
      continue
    }
    handledJobs = true
    idlePolls = 0
    batches += 1
    claimed += jobs.length
    await processJobsWithConcurrency(jobs, concurrency)
  }
  const elapsedMs = Date.now() - startedAt
  return { claimed, batches, elapsedMs, budgetExhausted: elapsedMs >= timeBudgetMs }
}

export async function safeProcessBrokerJobsInApp(options: RunnerOptions = {}) {
  try {
    return await processBrokerJobsInApp(options)
  } catch (error) {
    console.error('[broker-app-runner] failed', errorCode(error))
    return { claimed: 0, error: errorCode(error) }
  }
}
