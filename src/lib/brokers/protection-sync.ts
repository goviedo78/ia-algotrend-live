import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BrokerAdapter, BrokerOrderResult, BrokerTriggerOrder, ProtectionKind } from './adapters/types'
import { loadBrokerAdapter } from './adapter-loader'
import { writeBrokerAudit } from './audit'
import { normalizeSymbol, strategyTradeKey, type TradeDirection } from './domain'
import { BrokerPlatformError } from './errors'
import {
  desiredProtection,
  planProtectionSync,
  roundQuantityDown,
  type ActiveProtection,
  type DesiredProtection,
} from './protection'
import type { OwnedPosition } from './risk'
import { runtimeFlag } from './runtime'

/**
 * Ejecuta contra el broker lo que decide `protection.ts`: que cada posición propia tenga en el
 * broker el stop y el objetivo VIGENTES de su operación en la estrategia.
 *
 * Reglas que no se negocian:
 * - Lo nuevo se coloca ANTES de cancelar lo viejo. La posición nunca queda sin stop.
 * - Sólo se protege lo propio (ownership) y nunca más que lo que el broker muestra abierto.
 * - Un stop que disparó en el broker se asienta como un cierre más, con sus fills y su resultado,
 *   para que la contabilidad, el panel y el motor de riesgo vean la posición cerrada.
 */

export const SYNC_PROTECTION_MAX_ATTEMPTS = 3
const FILLED_INTENT_STATUSES = ['FILLED', 'PARTIALLY_FILLED']

/** Interruptor de emergencia: `BROKER_PROTECTION_ORDERS_ENABLED=false` lo apaga sin deploy de código. */
export function protectionOrdersEnabled() {
  const raw = process.env.BROKER_PROTECTION_ORDERS_ENABLED
  return raw === undefined || raw.trim() === '' || runtimeFlag('BROKER_PROTECTION_ORDERS_ENABLED')
}

type OwnedPositionsLoader = (connectionId: string) => Promise<OwnedPosition[]>

type ProtectionAdapter = BrokerAdapter & Required<Pick<
  BrokerAdapter,
  'placeTriggerOrder' | 'listOpenTriggerOrders' | 'getOrderById' | 'cancelOrderById'
>>

function supportsProtection(adapter: BrokerAdapter): adapter is ProtectionAdapter {
  return typeof adapter.placeTriggerOrder === 'function'
    && typeof adapter.listOpenTriggerOrders === 'function'
    && typeof adapter.getOrderById === 'function'
    && typeof adapter.cancelOrderById === 'function'
}

type IntentRow = {
  id: string
  user_id: string
  connection_id: string
  binding_id: string
  signal_id: string
  action: 'OPEN' | 'CLOSE'
  direction: TradeDirection
  symbol: string
  status: string
  policy_version: number
  origin?: string | null
}

type ProtectionRow = {
  id: string
  user_id: string
  connection_id: string
  open_intent_id: string
  strategy_code: string
  trade_key: string
  kind: ProtectionKind
  symbol: string
  direction: TradeDirection
  trigger_price: number | string
  quantity: number | string
  broker_order_id: string
  status: string
  created_at: string
}

type TargetRow = {
  strategy_code: string
  trade_key: string
  symbol: string
  direction: TradeDirection
  stop_loss: number | string
  take_profit: number | string | null
  status: 'OPEN' | 'CLOSED'
  version: number
}

type ActiveRow = ActiveProtection & { row: ProtectionRow }

function likePrefix(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function protectionSignalPrefix(tradeKey: string) {
  return `protection-${tradeKey}-`
}

function closingSide(direction: TradeDirection) {
  return direction === 'LONG' ? 'SELL' : 'BUY'
}

function toActive(row: ProtectionRow): ActiveRow {
  return {
    id: row.id,
    kind: row.kind,
    triggerPrice: Number(row.trigger_price),
    quantity: Number(row.quantity),
    brokerOrderId: row.broker_order_id,
    row,
  }
}

// ── Estado deseado (lo escribe el motor de la estrategia) ────────────────────────────────

export async function upsertStrategyProtection(input: {
  strategyCode: string
  tradeKey: string
  symbol: string
  direction: TradeDirection
  stopLoss: number
  takeProfit: number | null
}) {
  if (!(input.stopLoss > 0)) return { changed: false }
  const admin = createAdminClient()
  const { data: current, error } = await admin
    .from('broker_strategy_protection')
    .select('stop_loss, take_profit, status, version')
    .eq('strategy_code', input.strategyCode)
    .eq('trade_key', input.tradeKey)
    .maybeSingle()
  if (error) throw error
  const takeProfit = input.takeProfit != null && input.takeProfit > 0 ? input.takeProfit : null
  if (!current) {
    const { error: insertError } = await admin.from('broker_strategy_protection').insert({
      strategy_code: input.strategyCode,
      trade_key: input.tradeKey,
      symbol: normalizeSymbol(input.symbol),
      direction: input.direction,
      stop_loss: input.stopLoss,
      take_profit: takeProfit,
    })
    if (insertError && insertError.code !== '23505') throw insertError
    return { changed: true }
  }
  // Una operación cerrada no se reabre: un reintento tardío del motor no debe revivir su stop.
  if (current.status === 'CLOSED') return { changed: false }
  const sameStop = Math.abs(Number(current.stop_loss) - input.stopLoss) < 1e-9
  const sameTarget = current.take_profit == null
    ? takeProfit == null
    : takeProfit != null && Math.abs(Number(current.take_profit) - takeProfit) < 1e-9
  if (sameStop && sameTarget) return { changed: false }
  const { error: updateError } = await admin.from('broker_strategy_protection').update({
    stop_loss: input.stopLoss,
    take_profit: takeProfit,
    version: Number(current.version) + 1,
  }).eq('strategy_code', input.strategyCode).eq('trade_key', input.tradeKey).eq('status', 'OPEN')
  if (updateError) throw updateError
  return { changed: true }
}

export async function closeStrategyProtection(strategyCode: string, tradeKey: string) {
  const { error } = await createAdminClient().from('broker_strategy_protection')
    .update({ status: 'CLOSED' })
    .eq('strategy_code', strategyCode)
    .eq('trade_key', tradeKey)
    .eq('status', 'OPEN')
  if (error) throw error
}

// ── Encolado ─────────────────────────────────────────────────────────────────────────────

export async function enqueueProtectionSync(connectionId: string, intentId: string) {
  const { error } = await createAdminClient().from('broker_execution_jobs').insert({
    connection_id: connectionId,
    intent_id: intentId,
    job_type: 'SYNC_PROTECTION',
    max_attempts: SYNC_PROTECTION_MAX_ATTEMPTS,
  })
  // 23505: ya hay una sincronización pendiente para esta intención; esa alcanza.
  if (error && error.code !== '23505') throw error
}

/** Pide sincronizar todas las cuentas que tienen abierta esta operación de la estrategia. */
export async function requestStrategyProtectionSync(strategyCode: string, tradeKey: string) {
  const admin = createAdminClient()
  const { data: signals, error } = await admin
    .from('broker_signals')
    .select('id')
    .eq('strategy_code', strategyCode)
    .eq('action', 'OPEN')
    .ilike('external_signal_id', `${likePrefix(tradeKey)}-open%`)
  if (error) throw error
  if (!signals?.length) return 0
  const { data: intents, error: intentsError } = await admin
    .from('broker_order_intents')
    .select('id, connection_id')
    .in('signal_id', signals.map((signal) => signal.id))
    .eq('action', 'OPEN')
    .in('status', FILLED_INTENT_STATUSES)
  if (intentsError) throw intentsError
  for (const intent of intents ?? []) await enqueueProtectionSync(intent.connection_id, intent.id)
  return intents?.length ?? 0
}

async function loadTradeContext(intentId: string) {
  const admin = createAdminClient()
  const { data: intent, error } = await admin.from('broker_order_intents').select('*').eq('id', intentId).maybeSingle()
  if (error) throw error
  if (!intent) return null
  const { data: signal, error: signalError } = await admin
    .from('broker_signals')
    .select('id, external_signal_id, strategy_code, timeframe')
    .eq('id', intent.signal_id)
    .maybeSingle()
  if (signalError) throw signalError
  return {
    intent: intent as IntentRow,
    strategyCode: signal?.strategy_code ? String(signal.strategy_code) : null,
    tradeKey: strategyTradeKey(signal?.external_signal_id),
  }
}

async function loadTarget(strategyCode: string, tradeKey: string) {
  const { data, error } = await createAdminClient()
    .from('broker_strategy_protection')
    .select('*')
    .eq('strategy_code', strategyCode)
    .eq('trade_key', tradeKey)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as TargetRow | null
}

async function loadActiveRows(connectionId: string, filter: { tradeKey?: string; symbol?: string; direction?: TradeDirection }) {
  let query = createAdminClient()
    .from('broker_protection_orders')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('status', 'ACTIVE')
  if (filter.tradeKey) query = query.eq('trade_key', filter.tradeKey)
  if (filter.symbol) query = query.eq('symbol', filter.symbol)
  if (filter.direction) query = query.eq('direction', filter.direction)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProtectionRow[]
}

/** Llamado al terminar de reconciliar una orden: sólo encola si esa operación lleva protección. */
export async function enqueueProtectionSyncIfTracked(intentId: string) {
  if (!protectionOrdersEnabled()) return
  const context = await loadTradeContext(intentId)
  if (!context?.tradeKey || !context.strategyCode || context.intent.origin === 'PROTECTION') return
  const [target, rows] = await Promise.all([
    loadTarget(context.strategyCode, context.tradeKey),
    loadActiveRows(context.intent.connection_id, { tradeKey: context.tradeKey }),
  ])
  if (!target && rows.length === 0) return
  await enqueueProtectionSync(context.intent.connection_id, context.intent.id)
}

async function findOpenIntent(connectionId: string, strategyCode: string, tradeKey: string) {
  const admin = createAdminClient()
  const { data: signals, error } = await admin
    .from('broker_signals')
    .select('id')
    .eq('strategy_code', strategyCode)
    .eq('action', 'OPEN')
    .ilike('external_signal_id', `${likePrefix(tradeKey)}-open%`)
  if (error) throw error
  if (!signals?.length) return null
  const { data: intents, error: intentsError } = await admin
    .from('broker_order_intents')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('action', 'OPEN')
    .in('signal_id', signals.map((signal) => signal.id))
    .order('created_at', { ascending: false })
    .limit(1)
  if (intentsError) throw intentsError
  return (intents?.[0] ?? null) as IntentRow | null
}

async function currentPolicyVersion(connectionId: string) {
  const { data, error } = await createAdminClient()
    .from('broker_risk_policies')
    .select('version')
    .eq('connection_id', connectionId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new BrokerPlatformError('RISK_POLICY_NOT_FOUND', 'La conexión no tiene política de riesgo.', 409)
  return Number(data.version)
}

/**
 * Inserta (o recupera) la señal y la intención de un cierre que no pidió la estrategia sino la
 * protección. El identificador lleva el número de operación pero NO termina en `-close`: así
 * `strategyTradeKey` no lo confunde con el cierre de la estrategia ni lo usan las oportunidades
 * perdidas de otras cuentas.
 */
async function insertProtectionCloseIntent(input: {
  openIntent: IntentRow
  strategyCode: string
  externalSignalId: string
  referencePrice: number | null
  status: 'QUEUED' | 'FILLED'
  policyVersion: number
}) {
  const admin = createAdminClient()
  const { data: binding } = await admin
    .from('broker_strategy_bindings')
    .select('timeframe')
    .eq('id', input.openIntent.binding_id)
    .maybeSingle()
  const payloadHash = sha(`${input.externalSignalId}:${input.openIntent.connection_id}`)
  let signalId: string = randomUUID()
  const { error: signalError } = await admin.from('broker_signals').insert({
    id: signalId,
    external_signal_id: input.externalSignalId,
    strategy_code: input.strategyCode,
    symbol: normalizeSymbol(input.openIntent.symbol),
    timeframe: binding?.timeframe ?? '1h',
    action: 'CLOSE',
    direction: input.openIntent.direction,
    signal_time: new Date().toISOString(),
    reference_price: input.referencePrice,
    nonce: `protection-${payloadHash.slice(0, 48)}`,
    payload_hash: payloadHash,
  })
  if (signalError) {
    if (signalError.code !== '23505') throw signalError
    const { data: existing, error: existingError } = await admin
      .from('broker_signals')
      .select('id')
      .eq('strategy_code', input.strategyCode)
      .eq('external_signal_id', input.externalSignalId)
      .maybeSingle()
    if (existingError || !existing) throw existingError ?? signalError
    signalId = existing.id
  }

  const { data: inserted, error: intentError } = await admin.from('broker_order_intents').insert({
    user_id: input.openIntent.user_id,
    connection_id: input.openIntent.connection_id,
    binding_id: input.openIntent.binding_id,
    signal_id: signalId,
    action: 'CLOSE',
    direction: input.openIntent.direction,
    symbol: normalizeSymbol(input.openIntent.symbol),
    status: input.status,
    policy_version: input.policyVersion,
    client_order_id: `gp-${sha(`${input.openIntent.connection_id}:${signalId}`).slice(0, 32)}`,
    origin: 'PROTECTION',
  }).select('*').maybeSingle()
  if (intentError) {
    if (intentError.code !== '23505') throw intentError
    const { data: existing, error: existingError } = await admin
      .from('broker_order_intents')
      .select('*')
      .eq('connection_id', input.openIntent.connection_id)
      .eq('signal_id', signalId)
      .maybeSingle()
    if (existingError || !existing) throw existingError ?? intentError
    return existing as IntentRow
  }
  return inserted as IntentRow
}

/** Un stop/take profit que disparó en el broker pasa a ser una orden de cierre más en los libros. */
async function materializeTriggeredProtection(row: ProtectionRow, order: BrokerOrderResult) {
  const admin = createAdminClient()
  const { data: openIntent, error } = await admin
    .from('broker_order_intents')
    .select('*')
    .eq('id', row.open_intent_id)
    .maybeSingle()
  if (error || !openIntent) throw error ?? new BrokerPlatformError('INTENT_NOT_FOUND', 'Apertura protegida no encontrada.', 404)
  const quantity = order.filledQuantity > 0 ? order.filledQuantity : Number(row.quantity)
  const averagePrice = order.averagePrice ?? Number(row.trigger_price)
  const closeIntent = await insertProtectionCloseIntent({
    openIntent: openIntent as IntentRow,
    strategyCode: row.strategy_code,
    externalSignalId: `${protectionSignalPrefix(row.trade_key)}${row.kind === 'STOP_LOSS' ? 'sl' : 'tp'}-${row.id}`,
    referencePrice: averagePrice,
    status: 'FILLED',
    policyVersion: Number(openIntent.policy_version),
  })

  const { error: orderError } = await admin.from('broker_orders').upsert({
    user_id: row.user_id,
    connection_id: row.connection_id,
    intent_id: closeIntent.id,
    broker_order_id: row.broker_order_id,
    client_order_id: `gp-${sha(`order:${row.id}`).slice(0, 32)}`,
    symbol: normalizeSymbol(row.symbol),
    side: closingSide(row.direction),
    position_side: row.direction,
    reduce_only: true,
    requested_quantity: Number(row.quantity),
    filled_quantity: quantity,
    average_price: averagePrice,
    notional_usd: averagePrice * quantity,
    status: order.status === 'PARTIALLY_FILLED' ? 'PARTIALLY_FILLED' : 'FILLED',
    // Cuándo se envió la orden al broker: el piso desde el que hay que buscar sus fills.
    submitted_at: row.created_at,
    raw_status: order.rawStatus,
  }, { onConflict: 'intent_id' })
  if (orderError) throw orderError

  const { error: jobError } = await admin.from('broker_execution_jobs').insert({
    connection_id: row.connection_id,
    intent_id: closeIntent.id,
    job_type: 'RECONCILE_ORDER',
  })
  if (jobError && jobError.code !== '23505') throw jobError

  const { error: rowError } = await admin.from('broker_protection_orders').update({
    status: 'TRIGGERED',
    close_intent_id: closeIntent.id,
    last_error_code: null,
  }).eq('id', row.id)
  if (rowError) throw rowError

  await writeBrokerAudit({
    userId: row.user_id,
    connectionId: row.connection_id,
    eventType: 'PROTECTION_TRIGGERED',
    outcome: 'SUCCESS',
    metadata: { kind: row.kind, tradeKey: row.trade_key, triggerPrice: Number(row.trigger_price), quantity },
  })
}

async function markCanceled(row: ProtectionRow, code: string | null) {
  const { error } = await createAdminClient().from('broker_protection_orders')
    .update({ status: 'CANCELED', last_error_code: code })
    .eq('id', row.id)
    .eq('status', 'ACTIVE')
  if (error) throw error
}

type RowOutcome = 'ACTIVE' | 'CANCELED' | 'TRIGGERED'

/** Una orden nuestra que ya no figura entre las abiertas del broker: ¿disparó o se canceló? */
async function settleMissingRow(adapter: ProtectionAdapter, row: ProtectionRow): Promise<RowOutcome> {
  const order = await adapter.getOrderById(row.symbol, row.broker_order_id)
  if (order && (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED')) {
    await materializeTriggeredProtection(row, order)
    return 'TRIGGERED'
  }
  if (order && ['NEW', 'UNKNOWN'].includes(order.status)) return 'ACTIVE'
  // Cancelada a mano en el broker, vencida, rechazada al disparar o inexistente.
  await markCanceled(row, order ? `BROKER_${order.status}` : 'NOT_FOUND_AT_BROKER')
  return 'CANCELED'
}

async function cancelProtectionRow(adapter: ProtectionAdapter, row: ProtectionRow): Promise<RowOutcome> {
  try {
    await adapter.cancelOrderById(row.symbol, row.broker_order_id)
  } catch (error) {
    // La cancelación falla cuando la orden ya no está abierta: puede haber disparado justo ahora.
    const outcome = await settleMissingRow(adapter, row)
    if (outcome === 'ACTIVE') throw error
    return outcome
  }
  await markCanceled(row, null)
  await writeBrokerAudit({
    userId: row.user_id,
    connectionId: row.connection_id,
    eventType: 'PROTECTION_CANCELED',
    outcome: 'SUCCESS',
    metadata: { kind: row.kind, tradeKey: row.trade_key, triggerPrice: Number(row.trigger_price) },
  })
  return 'CANCELED'
}

/** Recorre las filas ACTIVE contra el broker: deja vivas sólo las que siguen abiertas allá. */
async function refreshRows(adapter: ProtectionAdapter, symbol: string, rows: ProtectionRow[]) {
  // Se lista siempre, aun sin filas: también sirve para adoptar una colocación ambigua.
  const openOrders = await adapter.listOpenTriggerOrders(symbol)
  const openIds = new Set(openOrders.map((order) => order.brokerOrderId))
  const live: ProtectionRow[] = []
  let triggered = false
  for (const row of rows) {
    if (openIds.has(row.broker_order_id)) {
      live.push(row)
      continue
    }
    const outcome = await settleMissingRow(adapter, row)
    if (outcome === 'ACTIVE') live.push(row)
    if (outcome === 'TRIGGERED') triggered = true
  }
  return { live, triggered, openOrders }
}

function ownedQuantity(owned: OwnedPosition[], symbol: string, direction: TradeDirection) {
  return owned
    .filter((position) => normalizeSymbol(position.symbol) === symbol && position.direction === direction)
    .reduce((total, position) => total + position.quantity, 0)
}

/**
 * El precio ya cruzó el nivel vigente: el stop habría disparado. Se sale a mercado por el camino
 * normal de ejecución (riesgo, ownership, contabilidad), con una intención propia de protección.
 */
async function requestProtectionMarketClose(input: {
  openIntent: IntentRow
  target: TargetRow
  crossed: DesiredProtection
}) {
  const kind = input.crossed.kind === 'STOP_LOSS' ? 'sl' : 'tp'
  const intent = await insertProtectionCloseIntent({
    openIntent: input.openIntent,
    strategyCode: input.target.strategy_code,
    externalSignalId: `${protectionSignalPrefix(input.target.trade_key)}${kind}-market-v${input.target.version}-${input.openIntent.id}`,
    referencePrice: input.crossed.triggerPrice,
    status: 'QUEUED',
    policyVersion: await currentPolicyVersion(input.openIntent.connection_id),
  })
  if (intent.status === 'QUEUED') {
    const { error } = await createAdminClient().from('broker_execution_jobs').insert({
      connection_id: intent.connection_id,
      intent_id: intent.id,
      job_type: 'EXECUTE_ORDER',
    })
    if (error && error.code !== '23505') throw error
  }
  await writeBrokerAudit({
    userId: input.openIntent.user_id,
    connectionId: input.openIntent.connection_id,
    eventType: 'PROTECTION_MARKET_CLOSE',
    outcome: 'SUCCESS',
    metadata: { kind: input.crossed.kind, tradeKey: input.target.trade_key, triggerPrice: input.crossed.triggerPrice },
  })
}

// ── Job SYNC_PROTECTION ──────────────────────────────────────────────────────────────────

export async function syncProtection(
  job: { connection_id: string; intent_id: string | null },
  deps: { ownedPositions: OwnedPositionsLoader },
): Promise<string> {
  if (!protectionOrdersEnabled()) return 'DISABLED'
  if (!job.intent_id) return 'NO_INTENT'
  const context = await loadTradeContext(job.intent_id)
  if (!context?.tradeKey || !context.strategyCode) return 'NO_TRADE_KEY'
  const { tradeKey, strategyCode } = context

  const [target, activeRows] = await Promise.all([
    loadTarget(strategyCode, tradeKey),
    loadActiveRows(job.connection_id, { tradeKey }),
  ])
  if (!target && activeRows.length === 0) return 'NOTHING_TO_DO'
  const openIntent = context.intent.action === 'OPEN'
    ? context.intent
    : await findOpenIntent(job.connection_id, strategyCode, tradeKey)
  if (!openIntent && activeRows.length === 0) return 'NO_OPEN_INTENT'

  const { connection, adapter } = await loadBrokerAdapter(job.connection_id)
  if (!supportsProtection(adapter)) return 'UNSUPPORTED_BROKER'

  const symbol = normalizeSymbol(openIntent?.symbol ?? activeRows[0].symbol)
  const direction = (openIntent?.direction ?? activeRows[0].direction) as TradeDirection
  const { live, openOrders } = await refreshRows(adapter, symbol, activeRows)

  // Lo deseado: stop y objetivo vigentes, por lo que esta conexión tiene abierto de verdad.
  let desired: DesiredProtection[] = []
  let pricePrecision = 8
  let quantityPrecision = 8
  let lastPrice = 0
  const wantsProtection = target?.status === 'OPEN'
    && openIntent != null
    && FILLED_INTENT_STATUSES.includes(openIntent.status)
    && ['ACTIVE', 'SUSPENDED'].includes(String(connection.status))
  if (wantsProtection && target) {
    const [owned, positions, rules] = await Promise.all([
      deps.ownedPositions(connection.id),
      adapter.getPositions(symbol),
      adapter.getInstrumentRules(symbol),
    ])
    pricePrecision = rules.pricePrecision
    quantityPrecision = rules.quantityPrecision
    const liveQuantity = positions
      .filter((position) => normalizeSymbol(position.symbol) === symbol && position.direction === direction)
      .reduce((total, position) => total + position.quantity, 0)
    // Nunca más que lo propio ni más que lo que el broker muestra abierto.
    const quantity = roundQuantityDown(Math.min(ownedQuantity(owned, symbol, direction), liveQuantity), quantityPrecision)
    desired = desiredProtection({
      stopLoss: Number(target.stop_loss),
      takeProfit: target.take_profit == null ? null : Number(target.take_profit),
    }, quantity, pricePrecision)
    if (desired.length) lastPrice = await adapter.getLastPrice(symbol)
  }

  const plan = planProtectionSync({
    direction,
    desired,
    active: live.map(toActive),
    lastPrice,
    pricePrecision,
    quantityPrecision,
  })

  if (plan.crossed && openIntent && target) {
    let triggered = false
    for (const active of plan.cancel) {
      if (await cancelProtectionRow(adapter, active.row) === 'TRIGGERED') triggered = true
    }
    // Si al cancelar resultó que el stop ya había disparado, la posición ya está cerrada.
    if (!triggered) await requestProtectionMarketClose({ openIntent, target, crossed: plan.crossed })
    return 'MARKET_CLOSE'
  }

  if (plan.place.length && openIntent && target) {
    const trackedIds = new Set(activeRows.map((row) => row.broker_order_id))
    const priceTolerance = 0.5 * 10 ** -Math.max(0, pricePrecision)
    const quantityTolerance = 0.5 * 10 ** -Math.max(0, quantityPrecision)
    for (const wanted of plan.place) {
      // Una colocación anterior pudo quedar ambigua (timeout): si la orden idéntica ya está
      // abierta en el broker, se adopta en vez de duplicarla.
      const orphan = openOrders.find((order: BrokerTriggerOrder) => (
        !trackedIds.has(order.brokerOrderId)
        && order.kind === wanted.kind
        && order.direction === direction
        && Math.abs(order.triggerPrice - wanted.triggerPrice) <= priceTolerance
        && Math.abs(order.quantity - wanted.quantity) <= quantityTolerance
      ))
      const brokerOrderId = orphan
        ? orphan.brokerOrderId
        : (await adapter.placeTriggerOrder({
            symbol,
            direction,
            kind: wanted.kind,
            triggerPrice: wanted.triggerPrice,
            quantity: wanted.quantity,
          })).brokerOrderId
      if (!brokerOrderId) {
        throw new BrokerPlatformError('PROTECTION_ORDER_ID_MISSING', 'El broker no identificó la orden de protección.', 503, true)
      }
      const { error } = await createAdminClient().from('broker_protection_orders').insert({
        user_id: openIntent.user_id,
        connection_id: connection.id,
        open_intent_id: openIntent.id,
        strategy_code: strategyCode,
        trade_key: tradeKey,
        kind: wanted.kind,
        symbol,
        direction,
        trigger_price: wanted.triggerPrice,
        quantity: wanted.quantity,
        broker_order_id: brokerOrderId,
        protection_version: target.version,
      })
      if (error && error.code !== '23505') throw error
      trackedIds.add(brokerOrderId)
      await writeBrokerAudit({
        userId: openIntent.user_id,
        connectionId: connection.id,
        eventType: 'PROTECTION_PLACED',
        outcome: 'SUCCESS',
        metadata: { kind: wanted.kind, tradeKey, triggerPrice: wanted.triggerPrice, quantity: wanted.quantity, adopted: Boolean(orphan) },
      })
    }
  }

  // Recién con lo nuevo puesto se retira lo viejo.
  for (const active of plan.cancel) await cancelProtectionRow(adapter, active.row)
  return plan.place.length || plan.cancel.length ? 'SYNCED' : 'UNCHANGED'
}

// ── Ganchos para el camino de ejecución ──────────────────────────────────────────────────

/**
 * Antes de una apertura: cualquier stop/objetivo nuestro que quede en ese símbolo y lado es de
 * una operación anterior. Si siguiera vivo cerraría la posición nueva a un nivel ajeno a ella.
 */
export async function cancelStaleProtection(input: {
  adapter: BrokerAdapter
  connectionId: string
  symbol: string
  direction: TradeDirection
}) {
  if (!protectionOrdersEnabled()) return
  const rows = await loadActiveRows(input.connectionId, {
    symbol: normalizeSymbol(input.symbol),
    direction: input.direction,
  })
  if (!rows.length || !supportsProtection(input.adapter)) return
  for (const row of rows) await cancelProtectionRow(input.adapter, row)
}

/**
 * Antes de ejecutar el cierre de la estrategia: si el stop o el objetivo del broker ya cerraron
 * esa operación, el cierre no tiene nada que hacer. Devuelve `true` en ese caso.
 */
export async function closeAlreadyDoneByProtection(input: {
  intent: IntentRow
  adapter: BrokerAdapter
  ownedPositions: OwnedPositionsLoader
}) {
  const context = await loadTradeContext(input.intent.id)
  if (!context?.tradeKey || !context.strategyCode) return false
  const symbol = normalizeSymbol(input.intent.symbol)
  const rows = await loadActiveRows(input.intent.connection_id, { tradeKey: context.tradeKey })
  if (rows.length && supportsProtection(input.adapter)) {
    // Detecta un disparo que todavía no asentamos (el sync horario aún no pasó).
    await refreshRows(input.adapter, symbol, rows)
  }

  const admin = createAdminClient()
  const { data: signals, error } = await admin
    .from('broker_signals')
    .select('id')
    .eq('strategy_code', context.strategyCode)
    .ilike('external_signal_id', `${likePrefix(protectionSignalPrefix(context.tradeKey))}%`)
  if (error) throw error
  if (!signals?.length) return false
  const { count, error: intentsError } = await admin
    .from('broker_order_intents')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', input.intent.connection_id)
    .eq('origin', 'PROTECTION')
    .in('status', FILLED_INTENT_STATUSES)
    .in('signal_id', signals.map((signal) => signal.id))
  if (intentsError) throw intentsError
  if (!count) return false

  const owned = await input.ownedPositions(input.intent.connection_id)
  return ownedQuantity(owned, symbol, input.intent.direction) <= 1e-12
}
