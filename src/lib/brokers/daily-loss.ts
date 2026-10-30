import type { RiskPolicy } from './domain'
import { BrokerPlatformError } from './errors'
import { NO_DAILY_LOSS_CUT_PCT } from './risk-profiles'

export function dailyLossStatus(policy: RiskPolicy, sizingCapitalUsd: number, netPnlTodayUsd: number) {
  const percent = policy.sizingMode === 'EQUITY_PERCENT'
  const disabled = percent && policy.dailyLossLimitPct >= NO_DAILY_LOSS_CUT_PCT
  const limitUsd = percent ? sizingCapitalUsd * policy.dailyLossLimitPct / 100 : policy.dailyLossLimitUsd
  const blocked = !disabled && netPnlTodayUsd <= -limitUsd
  const limitLabel = percent ? `${policy.dailyLossLimitPct}% (${limitUsd.toFixed(2)} USD)` : `${limitUsd.toFixed(2)} USD`
  const message = blocked
    ? `Corte de pérdida diaria alcanzado: pérdida neta de ${Math.max(0, -netPnlTodayUsd).toFixed(2)} USD; límite ${limitLabel}. Cambiar el porcentaje por entrada no cambia este corte. Revisá el corte diario en Editar capital o esperá al próximo día UTC.`
    : null
  return { disabled, limitUsd, netPnlTodayUsd, blocked, message }
}

export function assertDailyLossAllowsOpening(status: ReturnType<typeof dailyLossStatus>) {
  if (status.blocked) throw new BrokerPlatformError('RISK_DAILY_LOSS_LIMIT', status.message!, 422)
}
