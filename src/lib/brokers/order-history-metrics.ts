import type {
  BrokerOrderHistoryItem,
  BrokerOrderHistoryTotals,
  BrokerPerformanceStats,
} from './order-history-types'

type OpenCostBasis = {
  quantity: number
  notionalUsd: number
  feesUsd: number
  fundingUsd: number
  adjustmentsUsd: number
}

function finite(value: number) {
  return Number.isFinite(value) ? value : 0
}

function positive(value: number) {
  return Math.max(0, finite(value))
}

function effectiveTime(order: BrokerOrderHistoryItem) {
  return order.lastFillAt
    ?? order.reconciledAt
    ?? order.submittedAt
    ?? order.createdAt
}

function positionKey(order: BrokerOrderHistoryItem) {
  return `${order.connectionId}:${order.symbol.toUpperCase()}:${order.direction.toUpperCase()}`
}

function orderNotional(order: BrokerOrderHistoryItem) {
  const recorded = positive(order.notionalUsd)
  if (recorded > 0) return recorded
  return positive(order.filledQuantity) * positive(order.averagePrice ?? 0)
}

function estimatedGrossPnl(
  order: BrokerOrderHistoryItem,
  entryNotionalUsd: number,
  quantity: number,
) {
  const exitPrice = positive(order.averagePrice ?? 0)
  if (entryNotionalUsd <= 0 || quantity <= 0 || exitPrice <= 0) return null
  const entryPrice = entryNotionalUsd / quantity
  return order.direction.toUpperCase() === 'SHORT'
    ? (entryPrice - exitPrice) * quantity
    : (exitPrice - entryPrice) * quantity
}

/**
 * Pairs OPEN and CLOSE orders using an aggregate weighted cost basis per
 * connection, instrument and direction. Derived values are written only when
 * the complete closing quantity is covered by known opening orders.
 */
export function enrichBrokerTradeCycles(
  orders: BrokerOrderHistoryItem[],
): BrokerOrderHistoryItem[] {
  const enriched: BrokerOrderHistoryItem[] = orders.map((order): BrokerOrderHistoryItem => ({
    ...order,
    tradeNetPnlUsd: null,
    tradeFeesUsd: null,
    entryNotionalUsd: null,
    netReturnPct: null,
  }))
  const chronological = [...enriched].sort((left, right) => (
    new Date(effectiveTime(left)).getTime() - new Date(effectiveTime(right)).getTime()
  ))
  const openPositions = new Map<string, OpenCostBasis>()

  for (const order of chronological) {
    const quantity = positive(order.filledQuantity)
    if (quantity <= 0) continue
    const key = positionKey(order)

    if (order.action === 'OPEN') {
      const current = openPositions.get(key) ?? {
        quantity: 0,
        notionalUsd: 0,
        feesUsd: 0,
        fundingUsd: 0,
        adjustmentsUsd: 0,
      }
      current.quantity += quantity
      current.notionalUsd += orderNotional(order)
      current.feesUsd += positive(order.feesUsd)
      current.fundingUsd += finite(order.fundingUsd)
      current.adjustmentsUsd += finite(order.adjustmentsUsd)
      openPositions.set(key, current)
      continue
    }

    const current = openPositions.get(key)
    if (!current || current.quantity <= 0) continue
    const tolerance = Math.max(Number.EPSILON * current.quantity * 16, 1e-12)
    const coveredQuantity = Math.min(quantity, current.quantity)
    const allocationRatio = coveredQuantity / current.quantity
    const entryNotionalUsd = current.notionalUsd * allocationRatio
    const entryFeesUsd = current.feesUsd * allocationRatio
    const entryFundingUsd = current.fundingUsd * allocationRatio
    const entryAdjustmentsUsd = current.adjustmentsUsd * allocationRatio
    const fullyCovered = quantity <= current.quantity + tolerance

    if (fullyCovered) {
      const estimatedPnl = estimatedGrossPnl(order, entryNotionalUsd, coveredQuantity)
      if (estimatedPnl != null) {
        // A non-zero ledger value is authoritative. Zero remains correctly
        // represented by the price-based estimate for linear contracts.
        const grossPnlUsd = order.realizedPnlUsd !== 0
          ? finite(order.realizedPnlUsd)
          : estimatedPnl
        const tradeFeesUsd = entryFeesUsd + positive(order.feesUsd)
        const tradeNetPnlUsd = grossPnlUsd
          - tradeFeesUsd
          + entryFundingUsd
          + finite(order.fundingUsd)
          + entryAdjustmentsUsd
          + finite(order.adjustmentsUsd)
        order.entryNotionalUsd = entryNotionalUsd
        order.tradeFeesUsd = tradeFeesUsd
        order.tradeNetPnlUsd = tradeNetPnlUsd
        order.netReturnPct = entryNotionalUsd > 0
          ? tradeNetPnlUsd / entryNotionalUsd * 100
          : null
      }
    }

    const remainingRatio = Math.max(0, 1 - allocationRatio)
    current.quantity = Math.max(0, current.quantity - coveredQuantity)
    current.notionalUsd *= remainingRatio
    current.feesUsd *= remainingRatio
    current.fundingUsd *= remainingRatio
    current.adjustmentsUsd *= remainingRatio
    if (current.quantity <= tolerance) openPositions.delete(key)
  }

  return enriched
}

export function performanceFromBrokerOrders(
  orders: BrokerOrderHistoryItem[],
): BrokerPerformanceStats {
  const completeCloses = orders.filter((order) => (
    order.action === 'CLOSE'
    && order.tradeNetPnlUsd != null
    && order.entryNotionalUsd != null
    && order.netReturnPct != null
  ))
  const positiveTrades = completeCloses.filter((order) => (order.tradeNetPnlUsd ?? 0) > 0)
  const negativeTrades = completeCloses.filter((order) => (order.tradeNetPnlUsd ?? 0) < 0)
  const netValues = completeCloses.map((order) => order.tradeNetPnlUsd ?? 0)
  const returnValues = completeCloses.map((order) => order.netReturnPct ?? 0)
  const grossProfitUsd = positiveTrades.reduce((sum, order) => sum + (order.tradeNetPnlUsd ?? 0), 0)
  const grossLossUsd = Math.abs(negativeTrades.reduce((sum, order) => sum + (order.tradeNetPnlUsd ?? 0), 0))
  const closedTradeCount = completeCloses.length
  const winningTradeCount = positiveTrades.length
  const losingTradeCount = negativeTrades.length
  const closedTimes = completeCloses.map(effectiveTime).sort()

  return {
    closedTradeCount,
    winningTradeCount,
    losingTradeCount,
    breakevenTradeCount: closedTradeCount - winningTradeCount - losingTradeCount,
    winRatePct: closedTradeCount > 0 ? winningTradeCount / closedTradeCount * 100 : null,
    netPnlUsd: netValues.reduce((sum, value) => sum + value, 0),
    grossProfitUsd,
    grossLossUsd,
    profitFactor: grossLossUsd > 0 ? grossProfitUsd / grossLossUsd : null,
    averageNetPnlUsd: closedTradeCount > 0
      ? netValues.reduce((sum, value) => sum + value, 0) / closedTradeCount
      : null,
    averageWinUsd: winningTradeCount > 0 ? grossProfitUsd / winningTradeCount : null,
    averageLossUsd: losingTradeCount > 0 ? -(grossLossUsd / losingTradeCount) : null,
    bestTradeUsd: closedTradeCount > 0 ? Math.max(...netValues) : null,
    worstTradeUsd: closedTradeCount > 0 ? Math.min(...netValues) : null,
    averageReturnPct: closedTradeCount > 0
      ? returnValues.reduce((sum, value) => sum + value, 0) / closedTradeCount
      : null,
    bestTradeReturnPct: closedTradeCount > 0 ? Math.max(...returnValues) : null,
    worstTradeReturnPct: closedTradeCount > 0 ? Math.min(...returnValues) : null,
    totalFeesUsd: completeCloses.reduce((sum, order) => sum + positive(order.tradeFeesUsd ?? 0), 0),
    closedEntryNotionalUsd: completeCloses.reduce((sum, order) => sum + positive(order.entryNotionalUsd ?? 0), 0),
    unmatchedCloseCount: orders.filter((order) => (
      order.action === 'CLOSE'
      && positive(order.filledQuantity) > 0
      && order.tradeNetPnlUsd == null
    )).length,
    lastClosedAt: closedTimes.at(-1) ?? null,
  }
}

export function summarizeBrokerOrderHistory(orders: BrokerOrderHistoryItem[]): {
  totals: BrokerOrderHistoryTotals
  performance: BrokerPerformanceStats
} {
  const performance = performanceFromBrokerOrders(orders)
  const totals: BrokerOrderHistoryTotals = {
    realizedPnlUsd: orders.reduce((sum, order) => sum + finite(order.realizedPnlUsd), 0),
    feesUsd: orders.reduce((sum, order) => sum + positive(order.feesUsd), 0),
    fundingUsd: orders.reduce((sum, order) => sum + finite(order.fundingUsd), 0),
    adjustmentsUsd: orders.reduce((sum, order) => sum + finite(order.adjustmentsUsd), 0),
    netPnlUsd: performance.netPnlUsd,
    notionalUsd: orders.reduce((sum, order) => sum + positive(order.notionalUsd), 0),
    closedEntryNotionalUsd: performance.closedEntryNotionalUsd,
    netReturnPct: performance.closedEntryNotionalUsd > 0
      ? performance.netPnlUsd / performance.closedEntryNotionalUsd * 100
      : null,
    orderCount: orders.length,
    fillCount: orders.reduce((sum, order) => sum + order.fills.length, 0),
  }
  return { totals, performance }
}
