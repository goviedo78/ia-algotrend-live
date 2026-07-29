import type { BrokerConnectionDto, RiskPolicy } from './domain'

type Row = Record<string, unknown>

export function riskPolicyFromRow(row: Row | null | undefined): RiskPolicy | null {
  if (!row) return null
  return {
    enabled: Boolean(row.enabled),
    allowedSymbols: Array.isArray(row.allowed_symbols) ? row.allowed_symbols.map(String) : [],
    sizingMode: row.sizing_mode as RiskPolicy['sizingMode'],
    fixedNotionalUsd: Number(row.fixed_notional_usd),
    maxNotionalPerOrderUsd: Number(row.max_notional_per_order_usd),
    maxTotalExposureUsd: Number(row.max_total_exposure_usd),
    maxLeverage: Number(row.max_leverage),
    maxOpenPositions: Number(row.max_open_positions),
    maxOrdersPerMinute: Number(row.max_orders_per_minute),
    dailyLossLimitUsd: Number(row.daily_loss_limit_usd),
    minAvailableMarginUsd: Number(row.min_available_margin_usd),
    closeOnlyWhenSuspended: Boolean(row.close_only_when_suspended),
    declaredCapitalUsd: Number(row.declared_capital_usd),
    riskProfile: row.risk_profile as RiskPolicy['riskProfile'],
    exposurePerOrderPct: Number(row.exposure_per_order_pct),
    maxTotalExposurePct: Number(row.max_total_exposure_pct),
    dailyLossLimitPct: Number(row.daily_loss_limit_pct),
    marginReservePct: Number(row.margin_reserve_pct),
    suggestedNotionalPerOrderUsd: Number(row.suggested_notional_per_order_usd),
    suggestedMaxTotalExposureUsd: Number(row.suggested_max_total_exposure_usd),
    suggestedDailyLossLimitUsd: Number(row.suggested_daily_loss_limit_usd),
    suggestedMinAvailableMarginUsd: Number(row.suggested_min_available_margin_usd),
    version: Number(row.version),
  }
}

export function connectionDto(row: Row): BrokerConnectionDto {
  const policy = Array.isArray(row.broker_risk_policies)
    ? row.broker_risk_policies[0] as Row | undefined
    : row.broker_risk_policies as Row | undefined
  const bindings = Array.isArray(row.broker_strategy_bindings)
    ? row.broker_strategy_bindings as Row[]
    : []

  return {
    id: String(row.id),
    broker: row.broker as BrokerConnectionDto['broker'],
    environment: row.environment as BrokerConnectionDto['environment'],
    label: String(row.label),
    status: row.status as BrokerConnectionDto['status'],
    permissionsConfirmed: (row.permissions_confirmed ?? {}) as Record<string, boolean>,
    ipRestrictionConfirmed: Boolean(row.ip_restriction_confirmed),
    validatedAt: row.validated_at ? String(row.validated_at) : null,
    lastHealthCheckAt: row.last_health_check_at ? String(row.last_health_check_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    createdAt: String(row.created_at),
    requestedStrategy: {
      code: String(row.requested_strategy_code) as BrokerConnectionDto['requestedStrategy']['code'],
      symbol: String(row.requested_symbol),
      timeframe: String(row.requested_timeframe),
    },
    riskPolicy: riskPolicyFromRow(policy),
    bindings: bindings.map((binding) => ({
      id: String(binding.id),
      strategyCode: String(binding.strategy_code),
      symbol: String(binding.symbol),
      timeframe: String(binding.timeframe),
      enabled: Boolean(binding.enabled),
    })),
  }
}
