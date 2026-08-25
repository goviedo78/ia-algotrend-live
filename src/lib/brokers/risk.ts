import type { BrokerPosition, InstrumentRules } from './adapters/types'
import type { RiskPolicy, SignalAction, TradeDirection } from './domain'
import { normalizeSymbol } from './domain'
import { BrokerPlatformError } from './errors'
import { calculateOpeningFundingRequirement } from './funding-requirement'

// Posición abierta por ESTA conexión (cantidad neta propia), derivada de su historial
// de órdenes filled. Base de la regla permanente de ownership.
export interface OwnedPosition {
  symbol: string
  direction: TradeDirection
  quantity: number
}

export interface RiskEvaluationInput {
  action: SignalAction
  direction: TradeDirection
  symbol: string
  price: number
  sizingCapitalUsd: number
  availableMargin: number
  positions: BrokerPosition[]
  // Posiciones abiertas por ESTA conexión (net). Regla permanente de ownership: el motor
  // solo gestiona/cierra posiciones propias, nunca ajenas del mismo símbolo/lado.
  ownedPositions: OwnedPosition[]
  rules: InstrumentRules
  policy: RiskPolicy
  ordersLastMinute: number
  realizedPnlTodayUsd: number
  openingFeeRate: number
  connectionStatus: string
}

export interface ApprovedOrder {
  symbol: string
  direction: TradeDirection
  side: 'BUY' | 'SELL'
  quantity: number
  reduceOnly: boolean
  leverage: number
  notionalUsd: number
}

function reject(code: string, message: string): never {
  throw new BrokerPlatformError(code, message, 422)
}

function floorToStep(value: number, step: number, precision: number) {
  // Division by a decimal step can produce 0.9999999999999999 for an exact
  // broker lot. A scale-aware epsilon fixes that representation error without
  // ever rounding a genuinely smaller requested amount up to the next lot.
  const ratio = value / step
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 8
  const stepped = Math.floor(ratio + tolerance) * step
  return Number(stepped.toFixed(precision))
}

export function evaluateRisk(input: RiskEvaluationInput): ApprovedOrder {
  const { policy } = input
  const symbol = normalizeSymbol(input.symbol)
  const allowedSymbols = policy.allowedSymbols.map(normalizeSymbol)
  const activePositions = input.positions.filter((position) => position.quantity > 0)
  const activePolicyPositions = activePositions.filter((position) => allowedSymbols.includes(normalizeSymbol(position.symbol)))

  // Cantidad que ESTA conexión tiene abierta en (símbolo, dirección), según su propio historial.
  const ownedQtyFor = (positionSymbol: string, direction: TradeDirection) => {
    const owned = input.ownedPositions.find(
      (candidate) => normalizeSymbol(candidate.symbol) === normalizeSymbol(positionSymbol) && candidate.direction === direction,
    )
    return owned && owned.quantity > 0 ? owned.quantity : 0
  }

  // Posiciones propias (abiertas por esta conexión), con la cantidad acotada a lo propio.
  // Todo el razonamiento de riesgo opera sobre estas: nunca sobre posiciones ajenas.
  const ownedPolicyPositions = activePolicyPositions
    .map((position) => {
      const owned = ownedQtyFor(position.symbol, position.direction)
      if (owned <= 0) return null
      return {
        ...position,
        quantity: Math.min(position.quantity, owned),
        availableQuantity: Math.min(position.availableQuantity, owned),
      }
    })
    .filter((position): position is BrokerPosition => position !== null)

  const matching = ownedPolicyPositions.find((position) => (
    normalizeSymbol(position.symbol) === symbol && position.direction === input.direction
  ))
  const liveMatching = activePolicyPositions.find((position) => (
    normalizeSymbol(position.symbol) === symbol && position.direction === input.direction
  ))

  if (!Number.isFinite(input.price) || input.price <= 0) reject('RISK_INVALID_PRICE', 'Precio de mercado inválido.')
  if (ownedPolicyPositions.some((position) => !Number.isFinite(position.markPrice) || position.markPrice <= 0)) {
    reject('RISK_POSITION_PRICE_INVALID', 'No se pudo valorar una posición propia abierta.')
  }
  if (!allowedSymbols.includes(symbol)) reject('RISK_SYMBOL_DENIED', 'Símbolo no permitido.')
  if (input.action === 'OPEN' && !input.rules.openEnabled) reject('RISK_INSTRUMENT_OPEN_DISABLED', 'El broker no permite aperturas en este instrumento.')
  if (input.action === 'CLOSE' && !input.rules.closeEnabled) reject('RISK_INSTRUMENT_CLOSE_DISABLED', 'El broker no permite cierres en este instrumento.')

  if (input.action === 'CLOSE') {
    const closeAllowed = input.connectionStatus === 'ACTIVE'
      || (input.connectionStatus === 'SUSPENDED' && policy.closeOnlyWhenSuspended)
    if (!closeAllowed) reject('RISK_CLOSE_STATE_DENIED', 'La conexión no permite cierres automáticos en su estado actual.')
    // Ownership: solo cerramos una posición ABIERTA por esta conexión. Si en el broker
    // hay una posición que coincide pero no es propia, NO se toca (es de otra conexión o manual).
    if (!matching || matching.availableQuantity <= 0) {
      if (liveMatching && liveMatching.availableQuantity > 0) {
        reject('RISK_POSITION_NOT_OWNED', 'La posición abierta no pertenece a esta conexión; no se cierra.')
      }
      reject('RISK_POSITION_NOT_FOUND', 'No existe una posición propia para cerrar.')
    }
    const quantity = floorToStep(matching.availableQuantity, input.rules.quantityStep, input.rules.quantityPrecision)
    if (quantity <= 0) reject('RISK_QUANTITY_OUT_OF_RANGE', 'La posición no alcanza la cantidad mínima para cerrar.')
    return {
      symbol,
      direction: input.direction,
      side: input.direction === 'LONG' ? 'SELL' : 'BUY',
      quantity,
      reduceOnly: true,
      leverage: Math.max(1, matching.leverage),
      notionalUsd: quantity * input.price,
    }
  }

  if (input.connectionStatus !== 'ACTIVE') reject('RISK_CONNECTION_INACTIVE', 'La conexión no está activa.')
  if (!policy.enabled) reject('RISK_POLICY_DISABLED', 'La política de riesgo está desactivada.')
  const compoundSizing = policy.sizingMode === 'EQUITY_PERCENT'
  if (compoundSizing && (!Number.isFinite(input.sizingCapitalUsd) || input.sizingCapitalUsd <= 0)) {
    reject('RISK_ACCOUNT_EQUITY_INVALID', 'No se pudo calcular el capital actual de la cuenta.')
  }
  if (compoundSizing && (policy.exposurePerOrderPct <= 0 || policy.exposurePerOrderPct > 100)) {
    reject('RISK_LIMITS_NOT_CONFIGURED', 'El porcentaje compuesto no es válido.')
  }
  if (!compoundSizing && (policy.fixedNotionalUsd <= 0 || policy.maxNotionalPerOrderUsd <= 0 || policy.maxTotalExposureUsd <= 0)) {
    reject('RISK_LIMITS_NOT_CONFIGURED', 'Los límites de riesgo no están configurados.')
  }
  if (policy.maxLeverage < 1 || policy.maxOpenPositions < 1 || policy.maxOrdersPerMinute < 1) {
    reject('RISK_LIMITS_NOT_CONFIGURED', 'Los límites de riesgo no están configurados.')
  }
  const instrumentLeverageLimit = input.direction === 'LONG'
    ? input.rules.maximumLongLeverage
    : input.rules.maximumShortLeverage
  if (policy.maxLeverage > instrumentLeverageLimit) reject('RISK_LEVERAGE_UNSUPPORTED', 'El apalancamiento supera el máximo del instrumento.')
  if (input.ordersLastMinute >= policy.maxOrdersPerMinute) reject('RISK_RATE_LIMIT', 'Límite de órdenes por minuto alcanzado.')
  const configuredOrderNotionalUsd = compoundSizing
    ? input.sizingCapitalUsd * policy.exposurePerOrderPct / 100
    : policy.fixedNotionalUsd
  const maxTotalExposureUsd = compoundSizing
    ? input.sizingCapitalUsd * policy.maxTotalExposurePct / 100
    : policy.maxTotalExposureUsd
  const dailyLossLimitUsd = compoundSizing
    ? input.sizingCapitalUsd * policy.dailyLossLimitPct / 100
    : policy.dailyLossLimitUsd
  const configuredMinAvailableMarginUsd = compoundSizing
    ? input.sizingCapitalUsd * policy.marginReservePct / 100
    : policy.minAvailableMarginUsd
  if (configuredOrderNotionalUsd <= 0 || maxTotalExposureUsd <= 0 || dailyLossLimitUsd <= 0 || configuredMinAvailableMarginUsd < 0) {
    reject('RISK_LIMITS_NOT_CONFIGURED', 'Los límites de riesgo no están configurados.')
  }
  if (input.realizedPnlTodayUsd <= -dailyLossLimitUsd) {
    reject('RISK_DAILY_LOSS_LIMIT', 'Límite de pérdida diaria alcanzado.')
  }
  if (!Number.isFinite(input.availableMargin) || input.availableMargin <= 0) {
    reject('RISK_MARGIN_TOO_LOW', 'Margen disponible insuficiente.')
  }
  // En modo fijo el importe configurado manda: nunca se reduce silenciosamente para adaptar
  // la orden al saldo libre. Si no alcanza para orden + reserva, se rechaza con un motivo claro.
  // BingX recibe este importe como quoteOrderQty, por lo que 90 USD configurados son 90 USD
  // de exposición objetivo aunque la cantidad base resultante tenga decimales distintos.
  const orderNotionalUsd = Number(configuredOrderNotionalUsd.toFixed(8))
  // Ownership en apertura: no abrir si hay una posición AJENA en la dirección opuesta del
  // mismo símbolo. En modo one-way una apertura opuesta reduciría esa posición ajena; lo
  // evitamos para nunca afectar posiciones de otra conexión o manuales.
  const oppositeDirection: TradeDirection = input.direction === 'LONG' ? 'SHORT' : 'LONG'
  const foreignOppositeQuantity = activePolicyPositions
    .filter((position) => normalizeSymbol(position.symbol) === symbol && position.direction === oppositeDirection)
    .reduce((total, position) => total + Math.max(0, position.quantity - ownedQtyFor(position.symbol, position.direction)), 0)
  if (foreignOppositeQuantity > 0) reject('RISK_FOREIGN_OPPOSITE_POSITION', 'Existe una posición ajena en la dirección opuesta; no se abre para no afectarla.')

  // El límite y la exposición cuentan SOLO posiciones propias de esta conexión.
  if (!matching && ownedPolicyPositions.length >= policy.maxOpenPositions) reject('RISK_POSITION_LIMIT', 'Límite de posiciones abiertas alcanzado.')
  if (matching) reject('RISK_POSITION_ALREADY_OPEN', 'Ya existe una posición en esa dirección.')

  const currentExposure = ownedPolicyPositions.reduce((total, position) => total + Math.abs(position.quantity * position.markPrice), 0)
  if (!compoundSizing && orderNotionalUsd > policy.maxNotionalPerOrderUsd) reject('RISK_ORDER_NOTIONAL_LIMIT', 'El tamaño supera el máximo por orden.')
  if (currentExposure + orderNotionalUsd > maxTotalExposureUsd) reject('RISK_TOTAL_EXPOSURE_LIMIT', 'La exposición total superaría el máximo.')

  const quantity = floorToStep(orderNotionalUsd / input.price, input.rules.quantityStep, input.rules.quantityPrecision)
  if (quantity < input.rules.minimumQuantity || quantity > input.rules.maximumQuantity) {
    reject('RISK_QUANTITY_OUT_OF_RANGE', 'La cantidad no cumple las reglas del instrumento.')
  }
  if (orderNotionalUsd < input.rules.minimumNotional) reject('RISK_MINIMUM_NOTIONAL', 'El tamaño no alcanza el mínimo del instrumento.')
  if (!Number.isFinite(input.openingFeeRate) || input.openingFeeRate < 0) {
    reject('RISK_COMMISSION_RATE_INVALID', 'No se pudo calcular la comisión de apertura.')
  }
  const funding = calculateOpeningFundingRequirement({
    notionalUsd: orderNotionalUsd,
    leverage: policy.maxLeverage,
    reserveUsd: configuredMinAvailableMarginUsd,
    takerFeeRate: input.openingFeeRate,
  })
  if (input.availableMargin < funding.requiredAvailableMarginUsd) {
    reject(
      'RISK_MARGIN_RESERVE',
      `Saldo libre insuficiente: necesitás ${funding.requiredAvailableMarginUsd.toFixed(2)} USD, incluyendo ${funding.orderMarginUsd.toFixed(2)} USD de margen, ${funding.openingFeeUsd.toFixed(2)} USD de comisión y ${funding.reserveUsd.toFixed(2)} USD de reserva.`,
    )
  }

  return {
    symbol,
    direction: input.direction,
    side: input.direction === 'LONG' ? 'BUY' : 'SELL',
    quantity,
    reduceOnly: false,
    leverage: policy.maxLeverage,
    notionalUsd: orderNotionalUsd,
  }
}
