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
  lastClosedAt: string | null
}

export type BrokerOrderHistoryResponse = {
  orders: BrokerOrderHistoryItem[]
  totals: BrokerOrderHistoryTotals
  performance: BrokerPerformanceStats
}

export const EMPTY_BROKER_ORDER_HISTORY: BrokerOrderHistoryResponse = {
  orders: [],
  totals: {
    realizedPnlUsd: 0,
    feesUsd: 0,
    fundingUsd: 0,
    adjustmentsUsd: 0,
    netPnlUsd: 0,
    notionalUsd: 0,
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
    lastClosedAt: null,
  },
}
