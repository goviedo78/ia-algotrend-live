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

/**
 * Identidad del trade dentro de una estrategia, extraída del `external_signal_id`.
 *
 * Los dos emisores en producción numeran la operación y luego marcan el tramo:
 * `algotrend-btc-1h-358-open-1788444000` / `algotrend-btc-1h-358-close-1788444000`,
 * `gold30-309-open` / `gold30-309-close`. Esa numeración es el único dato que dice con
 * certeza si un cierre corresponde a la MISMA operación que una apertura, porque el
 * horario no alcanza: cuando un trade abre y toca su stop dentro de la misma vela, la
 * apertura y su cierre viajan con idéntico `signal_time`.
 *
 * Devuelve `null` para un identificador con otra forma; quien lo use debe entonces caer
 * en una regla conservadora, nunca en una permisiva.
 */
export function strategyTradeKey(externalSignalId: string | null | undefined) {
  if (!externalSignalId) return null
  const match = /^(.+)-(?:open|close)(?:-\d+)?$/i.exec(externalSignalId.trim())
  return match ? match[1].toLowerCase() : null
}
