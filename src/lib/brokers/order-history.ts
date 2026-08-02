import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  enrichBrokerTradeCycles,
  summarizeBrokerOrderHistory,
} from './order-history-metrics'
import { EMPTY_BROKER_ORDER_HISTORY } from './order-history-types'
import { brokerStrategy } from './strategies'
import type { BrokerOrderHistoryItem, BrokerOrderHistoryResponse } from './order-history-types'

type HistoryFilters = {
  userId?: string
  connectionId?: string
  limit?: number
  includeUserEmails?: boolean
}

type LedgerAmounts = {
  realizedPnlUsd: number
  feesUsd: number
  fundingUsd: number
  adjustmentsUsd: number
}

const EMPTY_AMOUNTS: LedgerAmounts = {
  realizedPnlUsd: 0,
  feesUsd: 0,
  fundingUsd: 0,
  adjustmentsUsd: 0,
}

export async function loadBrokerOrderHistory(
  filters: HistoryFilters = {},
): Promise<BrokerOrderHistoryResponse> {
  const admin = createAdminClient()
  const displayLimit = Math.min(250, Math.max(1, filters.limit ?? 100))
  // Older orders are cost-basis context for OPEN/CLOSE pairing only and never
  // leave the server in the response.
  const contextLimit = Math.min(1_000, Math.max(300, displayLimit * 3))
  let ordersQuery = admin.from('broker_orders').select(`
    id, user_id, connection_id, intent_id, client_order_id, broker_order_id,
    symbol, side, position_side, reduce_only, requested_quantity,
    filled_quantity, average_price, notional_usd, fee_usd, status,
    submitted_at, reconciled_at, created_at, updated_at
  `).order('created_at', { ascending: false }).limit(contextLimit)
  if (filters.userId) ordersQuery = ordersQuery.eq('user_id', filters.userId)
  if (filters.connectionId) ordersQuery = ordersQuery.eq('connection_id', filters.connectionId)

  const { data: orders, error: ordersError } = await ordersQuery
  if (ordersError) throw ordersError
  if (!orders?.length) return EMPTY_BROKER_ORDER_HISTORY

  const orderIds = orders.map((order) => order.id)
  const intentIds = orders.map((order) => order.intent_id)
  const connectionIds = [...new Set(orders.map((order) => order.connection_id))]
  const userIds = [...new Set(orders.map((order) => order.user_id))]
  const [intentsResult, fillsResult, ledgerResult, connectionsResult, profilesResult] = await Promise.all([
    admin.from('broker_order_intents').select('id, action, direction, signal_id').in('id', intentIds),
    admin.from('broker_fills')
      .select('id, order_id, broker_fill_id, quantity, price, fee, fee_asset, filled_at')
      .in('order_id', orderIds)
      .order('filled_at', { ascending: true }),
    admin.from('broker_ledger_entries')
      .select('order_id, entry_type, amount_usd')
      .in('order_id', orderIds)
      .limit(10_000),
    admin.from('broker_connections')
      .select('id, label, broker, environment, requested_strategy_code, requested_symbol, requested_timeframe')
      .in('id', connectionIds),
    filters.includeUserEmails
      ? admin.from('profiles').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const firstError = intentsResult.error
    || fillsResult.error
    || ledgerResult.error
    || connectionsResult.error
    || profilesResult.error
  if (firstError) throw firstError

  const signalIds = [...new Set((intentsResult.data ?? []).map((intent) => intent.signal_id))]
  const signalsResult = signalIds.length
    ? await admin.from('broker_signals')
        .select('id, external_signal_id, strategy_code, timeframe, signal_time')
        .in('id', signalIds)
    : { data: [], error: null }
  if (signalsResult.error) throw signalsResult.error

  const intents = new Map((intentsResult.data ?? []).map((intent) => [intent.id, intent]))
  const signals = new Map((signalsResult.data ?? []).map((signal) => [signal.id, signal]))
  const connections = new Map((connectionsResult.data ?? []).map((connection) => [connection.id, connection]))
  const emails = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.email]))
  const fillsByOrder = new Map<string, BrokerOrderHistoryItem['fills']>()
  for (const fill of fillsResult.data ?? []) {
    const current = fillsByOrder.get(fill.order_id) ?? []
    current.push({
      id: fill.id,
      brokerFillId: fill.broker_fill_id,
      quantity: Number(fill.quantity),
      price: Number(fill.price),
      fee: Math.abs(Number(fill.fee ?? 0)),
      feeAsset: fill.fee_asset,
      filledAt: fill.filled_at,
    })
    fillsByOrder.set(fill.order_id, current)
  }

  const ledgerByOrder = new Map<string, LedgerAmounts>()
  for (const entry of ledgerResult.data ?? []) {
    if (!entry.order_id) continue
    const current = ledgerByOrder.get(entry.order_id) ?? { ...EMPTY_AMOUNTS }
    const amount = Number(entry.amount_usd ?? 0)
    if (entry.entry_type === 'REALIZED_PNL') current.realizedPnlUsd += amount
    if (entry.entry_type === 'FEE') current.feesUsd += Math.abs(amount)
    if (entry.entry_type === 'FUNDING') current.fundingUsd += amount
    if (entry.entry_type === 'ADJUSTMENT') current.adjustmentsUsd += amount
    ledgerByOrder.set(entry.order_id, current)
  }

  const mappedOrders = orders.map((order): BrokerOrderHistoryItem => {
    const intent = intents.get(order.intent_id)
    const signal = intent ? signals.get(intent.signal_id) : null
    const connection = connections.get(order.connection_id)
    const strategyCode = signal?.strategy_code ?? connection?.requested_strategy_code ?? 'UNKNOWN'
    const strategy = brokerStrategy(strategyCode)
    const orderFills = fillsByOrder.get(order.id) ?? []
    const ledger = ledgerByOrder.get(order.id)
      ?? { ...EMPTY_AMOUNTS, feesUsd: Math.abs(Number(order.fee_usd ?? 0)) }
    const averagePrice = order.average_price == null ? null : Number(order.average_price)
    const filledQuantity = Number(order.filled_quantity ?? 0)
    const notionalUsd = Number(
      order.notional_usd
      ?? (averagePrice && filledQuantity ? averagePrice * filledQuantity : 0),
    )
    const netPnlUsd = ledger.realizedPnlUsd
      - ledger.feesUsd
      + ledger.fundingUsd
      + ledger.adjustmentsUsd

    return {
      id: order.id,
      userId: order.user_id,
      userEmail: emails.get(order.user_id) ?? null,
      connectionId: order.connection_id,
      connectionLabel: connection?.label ?? order.connection_id,
      broker: connection?.broker ?? 'UNKNOWN',
      environment: connection?.environment ?? 'UNKNOWN',
      strategyCode,
      strategyLabel: strategy?.label ?? strategyCode,
      timeframe: signal?.timeframe ?? connection?.requested_timeframe ?? '',
      externalSignalId: signal?.external_signal_id ?? null,
      signalTime: signal?.signal_time ?? null,
      action: intent?.action === 'CLOSE' || order.reduce_only ? 'CLOSE' : 'OPEN',
      symbol: order.symbol,
      side: order.side,
      direction: order.position_side || intent?.direction || 'LONG',
      reduceOnly: order.reduce_only,
      requestedQuantity: Number(order.requested_quantity),
      filledQuantity,
      averagePrice,
      notionalUsd,
      ...ledger,
      netPnlUsd,
      netReturnPct: null,
      tradeNetPnlUsd: null,
      tradeFeesUsd: null,
      entryNotionalUsd: null,
      status: order.status,
      clientOrderId: order.client_order_id,
      brokerOrderId: order.broker_order_id,
      submittedAt: order.submitted_at,
      reconciledAt: order.reconciled_at,
      firstFillAt: orderFills.at(0)?.filledAt ?? null,
      lastFillAt: orderFills.at(-1)?.filledAt ?? null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      fills: orderFills,
    }
  })

  const ordersWithCycles = enrichBrokerTradeCycles(mappedOrders)
  const result = ordersWithCycles.slice(0, displayLimit)
  return { orders: result, ...summarizeBrokerOrderHistory(result) }
}
