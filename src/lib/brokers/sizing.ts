import type { RiskPolicy } from './domain'
import { calculateOpeningFundingRequirement } from './funding-requirement'

// Techo de capital que guarda el modo "Todo el saldo": el tamaño real lo pone el saldo
// del broker, nunca este número. Es el máximo que acepta la aprobación por orden.
export const FULL_BALANCE_CAPITAL_USD = 1_000_000

export type SizingChoice = 'FULL_BALANCE' | 'PERCENT' | 'FIXED'

export function sizingChoiceOf(policy: Pick<RiskPolicy, 'sizingMode' | 'exposurePerOrderPct' | 'declaredCapitalUsd'>): SizingChoice {
  if (policy.sizingMode === 'FIXED_NOTIONAL') return 'FIXED'
  return policy.exposurePerOrderPct >= 100 && policy.declaredCapitalUsd >= FULL_BALANCE_CAPITAL_USD ? 'FULL_BALANCE' : 'PERCENT'
}

type SizingPolicy = Pick<RiskPolicy, 'sizingMode' | 'fixedNotionalUsd' | 'exposurePerOrderPct' | 'marginReservePct' | 'minAvailableMarginUsd' | 'maxLeverage'>

// Tamaño de la próxima apertura. En monto fijo el importe configurado manda y nunca se
// achica: si no alcanza, se rechaza. En modo porcentaje el objetivo se recorta al saldo
// libre real (margen + comisión + reserva), así "usar todo" no falla por centavos.
export function planOpeningNotional(input: {
  policy: SizingPolicy
  sizingCapitalUsd: number
  availableMarginUsd: number
  takerFeeRate: number
}) {
  const { policy } = input
  const percent = policy.sizingMode === 'EQUITY_PERCENT'
  const targetNotionalUsd = percent
    ? input.sizingCapitalUsd * policy.exposurePerOrderPct / 100
    : policy.fixedNotionalUsd
  const reserveUsd = percent
    ? input.sizingCapitalUsd * policy.marginReservePct / 100
    : policy.minAvailableMarginUsd
  const leverage = Math.max(1, policy.maxLeverage)
  const fee = Math.max(0, input.takerFeeRate)
  const fund = (notionalUsd: number) => calculateOpeningFundingRequirement({ notionalUsd, leverage, reserveUsd, takerFeeRate: fee })

  let notionalUsd = Number(Math.max(0, targetNotionalUsd).toFixed(8))
  let limitedByBalance = false
  const available = Number.isFinite(input.availableMarginUsd) ? Math.max(0, input.availableMarginUsd) : 0
  if (percent && fund(notionalUsd).requiredAvailableMarginUsd > available) {
    // Cada componente se redondea al centavo hacia arriba: se descuentan esos centavos y se
    // baja de a un centavo hasta cumplir exactamente el mismo umbral que valida el motor.
    let candidate = Math.floor((available - reserveUsd - 0.03) / (1 / leverage + fee) * 100) / 100
    for (let step = 0; step < 10 && candidate > 0 && fund(candidate).requiredAvailableMarginUsd > available; step++) {
      candidate = Math.round((candidate - 0.01) * 100) / 100
    }
    notionalUsd = Math.max(0, candidate)
    limitedByBalance = true
  }
  return { targetNotionalUsd, notionalUsd, limitedByBalance, ...fund(notionalUsd) }
}
