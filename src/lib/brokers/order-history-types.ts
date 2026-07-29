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

export type BrokerOrderHistoryResponse = {
  orders: BrokerOrderHistoryItem[]
  totals: BrokerOrderHistoryTotals
}
