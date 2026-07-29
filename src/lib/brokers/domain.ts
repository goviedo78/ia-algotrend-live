export const BROKERS = ['BINGX', 'BINANCE'] as const
export const BROKER_ENVIRONMENTS = ['DEMO', 'LIVE'] as const
export const CONNECTION_STATUSES = [
  'DRAFT',
  'PENDING_VALIDATION',
  'VALIDATION_FAILED',
  'PENDING_APPROVAL',
  'REJECTED',
  'ACTIVE',
  'SUSPENDED',
  'ROTATION_REQUIRED',
  'MANUAL_INTERVENTION_REQUIRED',
  'REVOKED',
  'DELETED',
] as const

export type BrokerCode = (typeof BROKERS)[number]
export type BrokerEnvironment = (typeof BROKER_ENVIRONMENTS)[number]
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]
export type TradeDirection = 'LONG' | 'SHORT'
export type SignalAction = 'OPEN' | 'CLOSE'
export type RiskProfile = 'ULTRA_CONSERVATIVE' | 'CONSERVATIVE' | 'MODERATE'
export type SizingMode = 'FIXED_NOTIONAL' | 'EQUITY_PERCENT'
export type { BrokerStrategyCode } from './strategies'

export const DELETABLE_CONNECTION_STATUSES = [
  'REVOKED',
  'REJECTED',
  'VALIDATION_FAILED',
] as const satisfies readonly ConnectionStatus[]

export function canDeleteConnection(status: ConnectionStatus) {
  return DELETABLE_CONNECTION_STATUSES.some((candidate) => candidate === status)
}

const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_VALIDATION: 'Validando',
  VALIDATION_FAILED: 'Validación fallida',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  REJECTED: 'Rechazada',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  ROTATION_REQUIRED: 'Requiere credenciales nuevas',
  MANUAL_INTERVENTION_REQUIRED: 'Revisión manual requerida',
  REVOKED: 'Revocada',
  DELETED: 'Eliminada',
}

export function connectionStatusLabel(status: ConnectionStatus) {
  return CONNECTION_STATUS_LABELS[status]
}

export interface BrokerCredentials {
  apiKey: string
  secretKey: string
}

export interface RiskPolicy {
  enabled: boolean
  allowedSymbols: string[]
  sizingMode: SizingMode
  fixedNotionalUsd: number
  maxNotionalPerOrderUsd: number
  maxTotalExposureUsd: number
  maxLeverage: number
  maxOpenPositions: number
  maxOrdersPerMinute: number
  dailyLossLimitUsd: number
  minAvailableMarginUsd: number
  closeOnlyWhenSuspended: boolean
  declaredCapitalUsd: number
  riskProfile: RiskProfile
  exposurePerOrderPct: number
  maxTotalExposurePct: number
  dailyLossLimitPct: number
  marginReservePct: number
  suggestedNotionalPerOrderUsd: number
  suggestedMaxTotalExposureUsd: number
  suggestedDailyLossLimitUsd: number
  suggestedMinAvailableMarginUsd: number
  version: number
}

export interface BrokerConnectionDto {
  id: string
  broker: BrokerCode
  environment: BrokerEnvironment
  label: string
  status: ConnectionStatus
  permissionsConfirmed: Record<string, boolean>
  ipRestrictionConfirmed: boolean
  validatedAt: string | null
  lastHealthCheckAt: string | null
  lastErrorCode: string | null
  createdAt: string
  requestedStrategy: {
    code: import('./strategies').BrokerStrategyCode
    symbol: string
    timeframe: string
  }
  riskPolicy: RiskPolicy | null
  bindings: Array<{
    id: string
    strategyCode: string
    symbol: string
    timeframe: string
    enabled: boolean
  }>
}

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
}

export function isLiveEnvironment(value: BrokerEnvironment) {
  return value === 'LIVE'
}
