import type { RiskProfile } from './domain'

const PROFILES: Record<RiskProfile, {
  exposurePerOrderPct: number
  maxTotalExposurePct: number
  dailyLossLimitPct: number
  marginReservePct: number
}> = {
  ULTRA_CONSERVATIVE: {
    exposurePerOrderPct: 3,
    maxTotalExposurePct: 6,
    dailyLossLimitPct: 1,
    marginReservePct: 70,
  },
  CONSERVATIVE: {
    exposurePerOrderPct: 5,
    maxTotalExposurePct: 10,
    dailyLossLimitPct: 2,
    marginReservePct: 60,
  },
  MODERATE: {
    exposurePerOrderPct: 8,
    maxTotalExposurePct: 16,
    dailyLossLimitPct: 3,
    marginReservePct: 50,
  },
}

function money(value: number) {
  return Math.floor(value * 100) / 100
}

export function deriveRiskSuggestion(capitalUsd: number, profile: RiskProfile, allocationPct?: number) {
  const limits = PROFILES[profile]
  const exposurePerOrderPct = Math.min(100, Math.max(1, allocationPct ?? limits.exposurePerOrderPct))
  const maxTotalExposurePct = Math.min(100, Math.max(limits.maxTotalExposurePct, exposurePerOrderPct))
  const marginReservePct = allocationPct != null ? Math.max(0, Math.min(limits.marginReservePct, 100 - exposurePerOrderPct)) : limits.marginReservePct
  return {
    declaredCapitalUsd: capitalUsd,
    riskProfile: profile,
    ...limits,
    exposurePerOrderPct,
    maxTotalExposurePct,
    marginReservePct,
    suggestedNotionalPerOrderUsd: money(capitalUsd * exposurePerOrderPct / 100),
    suggestedMaxTotalExposureUsd: money(capitalUsd * maxTotalExposurePct / 100),
    suggestedDailyLossLimitUsd: money(capitalUsd * limits.dailyLossLimitPct / 100),
    suggestedMinAvailableMarginUsd: money(capitalUsd * marginReservePct / 100),
  }
}
