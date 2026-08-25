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
