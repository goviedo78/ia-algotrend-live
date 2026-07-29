import type { BrokerPosition } from '@/lib/brokers/adapters/types'

type AppTradeState = {
  id: number
  direction: 'LONG' | 'SHORT'
} | null

type RecoveryExecution = {
  status: string
  updated_at: string
}

export type LegacyBingxHealthStatus =
  | 'PAUSED'
  | 'PAUSED_WITH_OPEN_POSITION'
  | 'PAUSED_WITH_OPEN_ORDERS'
  | 'PAUSED_WITH_RECOVERY_PENDING'
  | 'HEALTHY'
  | 'RECOVERING'
  | 'RECOVERY_REQUIRED'
  | 'DESYNCHRONIZED'

export function evaluateLegacyBingxHealth(input: {
  tradingEnabled: boolean
  appTrade: AppTradeState
  positions: BrokerPosition[]
  openOrderCount: number
  unresolvedExecutions: RecoveryExecution[]
  now?: number
}): LegacyBingxHealthStatus {
  if (!input.tradingEnabled) {
    if (input.positions.length > 0) return 'PAUSED_WITH_OPEN_POSITION'
    if (input.openOrderCount > 0) return 'PAUSED_WITH_OPEN_ORDERS'
    if (input.unresolvedExecutions.length > 0) return 'PAUSED_WITH_RECOVERY_PENDING'
    return 'PAUSED'
  }

  const now = input.now ?? Date.now()
  const staleRecovery = input.unresolvedExecutions.some((execution) => {
    const updatedAt = Date.parse(execution.updated_at)
    return !Number.isFinite(updatedAt) || now - updatedAt > 2 * 60 * 1000
  })
  if (staleRecovery) return 'RECOVERY_REQUIRED'
  if (input.unresolvedExecutions.length > 0) return 'RECOVERING'
  if (input.openOrderCount > 0) return 'DESYNCHRONIZED'

  if (!input.appTrade) {
    return input.positions.length === 0 ? 'HEALTHY' : 'DESYNCHRONIZED'
  }

  return input.positions.length === 1
    && input.positions[0].direction === input.appTrade.direction
    ? 'HEALTHY'
    : 'DESYNCHRONIZED'
}
