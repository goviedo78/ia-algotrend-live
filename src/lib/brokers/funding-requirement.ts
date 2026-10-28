import { BrokerPlatformError } from './errors'

export const DEFAULT_BINGX_TAKER_FEE_RATE = 0.0005

function ceilUsd(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.ceil((value - Number.EPSILON) * 100) / 100
}

export function calculateOpeningFundingRequirement(input: {
  notionalUsd: number
  leverage: number
  reserveUsd: number
  takerFeeRate: number
}) {
  const leverage = Math.max(1, input.leverage)
  const orderMarginUsd = ceilUsd(input.notionalUsd / leverage)
  const openingFeeUsd = ceilUsd(input.notionalUsd * Math.max(0, input.takerFeeRate))
  const reserveUsd = ceilUsd(input.reserveUsd)

  return {
    orderMarginUsd,
    openingFeeUsd,
    reserveUsd,
    // Sumamos componentes ya redondeados hacia arriba. El valor visible queda
    // deliberadamente del lado seguro y es exactamente el umbral que valida el motor.
    requiredAvailableMarginUsd: ceilUsd(orderMarginUsd + openingFeeUsd + reserveUsd),
  }
}

/** One plan for the worker and every funding estimate. Fixed amounts stay exact;
 * compound amounts fit commission and the configured reserve inside free capital. */
export function planOpeningFunding(input: {
  targetNotionalUsd: number
  leverage: number
  reserveUsd: number
  takerFeeRate: number
  compoundCapitalUsd?: number
  availableMarginUsd?: number
}) {
  if (!Number.isFinite(input.takerFeeRate) || input.takerFeeRate < 0) {
    throw new BrokerPlatformError('RISK_COMMISSION_RATE_INVALID', 'No se pudo calcular la comisión de apertura.', 422)
  }
  if (![input.targetNotionalUsd, input.leverage, input.reserveUsd].every(Number.isFinite)
    || input.targetNotionalUsd < 0 || input.leverage < 1 || input.reserveUsd < 0
    || (input.compoundCapitalUsd !== undefined && (!Number.isFinite(input.compoundCapitalUsd) || input.compoundCapitalUsd < 0))
    || (input.availableMarginUsd !== undefined && (!Number.isFinite(input.availableMarginUsd) || input.availableMarginUsd < 0))) {
    throw new BrokerPlatformError('RISK_LIMITS_NOT_CONFIGURED', 'No se pudo calcular el capital disponible para abrir.', 422)
  }
  const configuredNotionalUsd = Number(input.targetNotionalUsd.toFixed(8))
  const fundingFor = (notionalUsd: number) => calculateOpeningFundingRequirement({
    ...input, notionalUsd,
  })
  let targetNotionalUsd = configuredNotionalUsd
  if (input.compoundCapitalUsd !== undefined) {
    const budget = Math.max(0, Math.min(
      input.compoundCapitalUsd,
      input.availableMarginUsd ?? input.compoundCapitalUsd,
    ))
    if (fundingFor(targetNotionalUsd).requiredAvailableMarginUsd > budget) {
      // Search whole cents against the same rounded margin and fee that execution
      // validates. A formula alone can still be one cent short after rounding.
      let low = 0
      let high = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(configuredNotionalUsd * 100))
      while (low < high) {
        const mid = low + Math.ceil((high - low) / 2)
        if (fundingFor(mid / 100).requiredAvailableMarginUsd <= budget) low = mid
        else high = mid - 1
      }
      targetNotionalUsd = low / 100
    }
  }
  return {
    configuredNotionalUsd,
    targetNotionalUsd,
    adjustedForFunding: targetNotionalUsd < configuredNotionalUsd,
    ...fundingFor(targetNotionalUsd),
  }
}
