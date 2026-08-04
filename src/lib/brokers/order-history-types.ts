export type BrokerFillDetail = {
  id: string
  brokerFillId: string
  quantity: number
  price: number
  fee: number
  feeAsset: string | null
  filledAt: string
}

export type BrokerOrderHistoryItem = {
  id: string
  userId: string
  userEmail: string | null
  connectionId: string
  connectionLabel: string
  broker: string
  environment: string
  strategyCode: string
  strategyLabel: string
  timeframe: string
  externalSignalId: string | null
  signalTime: string | null
  action: 'OPEN' | 'CLOSE'
  symbol: string
  side: string
  direction: string
  reduceOnly: boolean
  requestedQuantity: number
  filledQuantity: number
  averagePrice: number | null
  notionalUsd: number
  realizedPnlUsd: number
  feesUsd: number
  fundingUsd: number
  adjustmentsUsd: number
  netPnlUsd: number
  tradeNetPnlUsd: number | null
  tradeFeesUsd: number | null
  entryNotionalUsd: number | null
  netReturnPct: number | null
  status: string
  clientOrderId: string
  brokerOrderId: string | null
  submittedAt: string | null
  reconciledAt: string | null
  firstFillAt: string | null
  lastFillAt: string | null
  createdAt: string
  updatedAt: string
  fills: BrokerFillDetail[]
}

export type BrokerOrderHistoryTotals = {
  realizedPnlUsd: number
  feesUsd: number
  fundingUsd: number
  adjustmentsUsd: number
  netPnlUsd: number
  notionalUsd: number
  closedEntryNotionalUsd: number
  netReturnPct: number | null
  orderCount: number
  fillCount: number
}

export type BrokerPerformanceStats = {
  closedTradeCount: number
  winningTradeCount: number
  losingTradeCount: number
  breakevenTradeCount: number
  winRatePct: number | null
  netPnlUsd: number
  grossProfitUsd: number
  grossLossUsd: number
  profitFactor: number | null
  averageNetPnlUsd: number | null
  averageWinUsd: number | null
  averageLossUsd: number | null
  bestTradeUsd: number | null
  worstTradeUsd: number | null
  averageReturnPct: number | null
  bestTradeReturnPct: number | null
  worstTradeReturnPct: number | null
  totalFeesUsd: number
  closedEntryNotionalUsd: number
  unmatchedCloseCount: number
  lastClosedAt: string | null
}

/**
 * Una operación que el motor rechazó antes de enviarla al broker. Si fue una apertura y la
 * estrategia ya emitió su cierre, `missedReturnPct` dice qué habría dado ese trade.
 */
export type BrokerMissedOpportunity = {
  id: string
  connectionId: string
  connectionLabel: string
  strategyCode: string
  strategyLabel: string
  symbol: string
  action: 'OPEN' | 'CLOSE'
  direction: 'LONG' | 'SHORT'
  rejectionCode: string | null
  reason: string
  insufficientFunds: boolean
  rejectedAt: string
  signalTime: string | null
  entryPrice: number | null
  exitPrice: number | null
  closedAt: string | null
  notionalUsd: number | null
  missedReturnPct: number | null
  missedGrossPnlUsd: number | null
  outcome: 'WIN' | 'LOSS' | 'FLAT' | 'PENDING' | 'NOT_APPLICABLE'
}

export type BrokerOrderHistoryResponse = {
  orders: BrokerOrderHistoryItem[]
  totals: BrokerOrderHistoryTotals
  performance: BrokerPerformanceStats
  missedOpportunities: BrokerMissedOpportunity[]
}

export const EMPTY_BROKER_ORDER_HISTORY: BrokerOrderHistoryResponse = {
  orders: [],
  missedOpportunities: [],
  totals: {
    realizedPnlUsd: 0,
    feesUsd: 0,
    fundingUsd: 0,
    adjustmentsUsd: 0,
    netPnlUsd: 0,
    notionalUsd: 0,
    closedEntryNotionalUsd: 0,
    netReturnPct: null,
    orderCount: 0,
    fillCount: 0,
  },
  performance: {
    closedTradeCount: 0,
    winningTradeCount: 0,
    losingTradeCount: 0,
    breakevenTradeCount: 0,
    winRatePct: null,
    netPnlUsd: 0,
    grossProfitUsd: 0,
    grossLossUsd: 0,
    profitFactor: null,
    averageNetPnlUsd: null,
    averageWinUsd: null,
    averageLossUsd: null,
    bestTradeUsd: null,
    worstTradeUsd: null,
    averageReturnPct: null,
    bestTradeReturnPct: null,
    worstTradeReturnPct: null,
    totalFeesUsd: 0,
    closedEntryNotionalUsd: 0,
    unmatchedCloseCount: 0,
    lastClosedAt: null,
  },
}
