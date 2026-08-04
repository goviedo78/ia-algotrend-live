import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeSymbol } from './domain'
import { brokerStrategy } from './strategies'
import type { BrokerMissedOpportunity } from './order-history-types'

// Motivos de rechazo en lenguaje del titular. El código crudo igual viaja en la respuesta
// para soporte, pero la UI muestra esta frase.
const REJECTION_REASONS: Record<string, string> = {
  RISK_MARGIN_TOO_LOW: 'Sin fondos: el margen disponible en el broker no llegaba a la reserva mínima.',
  RISK_MARGIN_RESERVE: 'Sin fondos: la orden habría consumido el margen reservado de la cuenta.',
  RISK_MINIMUM_NOTIONAL: 'El lotaje configurado no alcanzaba el mínimo que exige el instrumento.',
  RISK_QUANTITY_OUT_OF_RANGE: 'La cantidad resultante no cumplía las reglas de contrato del instrumento.',
  RISK_TOTAL_EXPOSURE_LIMIT: 'La exposición total de la conexión habría superado su máximo.',
  RISK_ORDER_NOTIONAL_LIMIT: 'El tamaño de la orden superaba el máximo por operación.',
  RISK_DAILY_LOSS_LIMIT: 'Se había alcanzado el corte de pérdida diaria de la conexión.',
  RISK_POSITION_LIMIT: 'Ya había una posición abierta por esta conexión.',
  RISK_POSITION_ALREADY_OPEN: 'Ya existía una posición abierta en esa misma dirección.',
  RISK_FOREIGN_OPPOSITE_POSITION: 'Había una posición ajena en la dirección opuesta y no se tocó.',
  RISK_POSITION_NOT_OWNED: 'La posición abierta no pertenecía a esta conexión.',
  RISK_POSITION_NOT_FOUND: 'No existía una posición propia para cerrar.',
  RISK_RATE_LIMIT: 'Se alcanzó el límite de órdenes por minuto de la conexión.',
  RISK_SYMBOL_DENIED: 'El símbolo no estaba habilitado para esta conexión.',
  RISK_CONNECTION_INACTIVE: 'La conexión no estaba activa en ese momento.',
  RISK_POLICY_DISABLED: 'La política de riesgo estaba desactivada.',
  RISK_LIMITS_NOT_CONFIGURED: 'Los límites de riesgo no estaban configurados.',
  RISK_ACCOUNT_EQUITY_INVALID: 'No se pudo leer el capital real de la cuenta.',
  RISK_INVALID_PRICE: 'El precio de mercado recibido no era válido.',
  RISK_LEVERAGE_UNSUPPORTED: 'El apalancamiento superaba el máximo del instrumento.',
  RISK_INSTRUMENT_OPEN_DISABLED: 'El broker no permitía aperturas en este instrumento.',
  RISK_INSTRUMENT_CLOSE_DISABLED: 'El broker no permitía cierres en este instrumento.',
}

// Códigos que significan literalmente "no había plata en la cuenta".
const INSUFFICIENT_FUNDS_CODES = new Set(['RISK_MARGIN_TOO_LOW', 'RISK_MARGIN_RESERVE'])

export function rejectionReason(code: string | null) {
  if (!code) return 'La orden fue rechazada antes de enviarse al broker.'
  return REJECTION_REASONS[code] ?? `La orden fue rechazada por el motor de riesgo (${code}).`
}

type SignalRow = {
  id: string
  strategy_code: string
  symbol: string
  action: string
  direction: string
  signal_time: string
  reference_price: number | string | null
}

type IntentRow = {
  id: string
  connection_id: string
  signal_id: string
  action: string
  direction: string
  symbol: string
  rejection_code: string | null
  created_at: string
}

function numberOrNull(value: number | string | null | undefined) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Calcula qué habría pasado con una operación que el motor rechazó.
 *
 * El porcentaje es exacto: sale de los precios de referencia de la señal de apertura y de la
 * señal de cierre que la estrategia emitió después. El importe en USD es una estimación, porque
 * se aplica el lotaje configurado hoy y no descuenta comisiones: por eso viaja separado y la UI
 * lo rotula como bruto.
 */
export function computeMissedResult(input: {
  direction: string
  entryPrice: number | null
  exitPrice: number | null
  notionalUsd: number | null
}) {
  const { entryPrice, exitPrice } = input
  if (!entryPrice || !exitPrice) {
    return { missedReturnPct: null, missedGrossPnlUsd: null, outcome: 'PENDING' as const }
  }
  const rawPct = (exitPrice - entryPrice) / entryPrice * 100
  const missedReturnPct = input.direction === 'SHORT' ? -rawPct : rawPct
  const missedGrossPnlUsd = input.notionalUsd == null
    ? null
    : input.notionalUsd * missedReturnPct / 100
  const outcome = Math.abs(missedReturnPct) < 1e-9
    ? ('FLAT' as const)
    : missedReturnPct > 0
      ? ('WIN' as const)
      : ('LOSS' as const)
  return { missedReturnPct, missedGrossPnlUsd, outcome }
}

/**
 * Empareja cada apertura rechazada con la primera señal de cierre posterior de la misma
 * estrategia, símbolo y dirección. Ese par define el trade que el titular se perdió.
 */
export function buildMissedOpportunities(input: {
  intents: IntentRow[]
  signalsById: Map<string, SignalRow>
  laterSignals: SignalRow[]
  connections: Map<string, { label: string; notionalUsd: number | null }>
}): BrokerMissedOpportunity[] {
  const closesByKey = new Map<string, SignalRow[]>()
  for (const signal of input.laterSignals) {
    if (signal.action !== 'CLOSE') continue
    const key = `${signal.strategy_code}:${normalizeSymbol(signal.symbol)}:${signal.direction}`
    const bucket = closesByKey.get(key) ?? []
    bucket.push(signal)
    closesByKey.set(key, bucket)
  }
  for (const bucket of closesByKey.values()) {
    bucket.sort((a, b) => new Date(a.signal_time).getTime() - new Date(b.signal_time).getTime())
  }

  return input.intents.map((intent) => {
    const signal = input.signalsById.get(intent.signal_id) ?? null
    const connection = input.connections.get(intent.connection_id)
    const strategyCode = signal?.strategy_code ?? 'UNKNOWN'
    const strategy = brokerStrategy(strategyCode)
    const entryPrice = numberOrNull(signal?.reference_price)
    const notionalUsd = connection?.notionalUsd ?? null

    // Sólo una apertura perdida tiene un resultado que mostrar: un cierre rechazado deja la
    // posición viva, no genera un trade fantasma.
    let exitPrice: number | null = null
    let closedAt: string | null = null
    if (intent.action === 'OPEN' && signal) {
      const key = `${strategyCode}:${normalizeSymbol(intent.symbol)}:${intent.direction}`
      const openedAt = new Date(signal.signal_time).getTime()
      const close = (closesByKey.get(key) ?? []).find(
        (candidate) => new Date(candidate.signal_time).getTime() > openedAt,
      )
      if (close) {
        exitPrice = numberOrNull(close.reference_price)
        closedAt = close.signal_time
      }
    }

    const result = intent.action === 'OPEN'
      ? computeMissedResult({ direction: intent.direction, entryPrice, exitPrice, notionalUsd })
      : { missedReturnPct: null, missedGrossPnlUsd: null, outcome: 'NOT_APPLICABLE' as const }

    return {
      id: intent.id,
      connectionId: intent.connection_id,
      connectionLabel: connection?.label ?? intent.connection_id,
      strategyCode,
      strategyLabel: strategy?.label ?? strategyCode,
      symbol: intent.symbol,
      action: intent.action === 'CLOSE' ? 'CLOSE' : 'OPEN',
      direction: intent.direction === 'SHORT' ? 'SHORT' : 'LONG',
      rejectionCode: intent.rejection_code,
      reason: rejectionReason(intent.rejection_code),
      insufficientFunds: INSUFFICIENT_FUNDS_CODES.has(intent.rejection_code ?? ''),
      rejectedAt: intent.created_at,
      signalTime: signal?.signal_time ?? null,
      entryPrice,
      exitPrice,
      closedAt,
      notionalUsd,
      ...result,
    } satisfies BrokerMissedOpportunity
  })
}

export async function loadMissedOpportunities(filters: {
  userId?: string
  connectionId?: string
  limit?: number
}): Promise<BrokerMissedOpportunity[]> {
  const admin = createAdminClient()
  const limit = Math.min(100, Math.max(1, filters.limit ?? 40))

  let intentsQuery = admin
    .from('broker_order_intents')
    .select('id, connection_id, signal_id, action, direction, symbol, rejection_code, created_at')
    .eq('status', 'RISK_REJECTED')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (filters.userId) intentsQuery = intentsQuery.eq('user_id', filters.userId)
  if (filters.connectionId) intentsQuery = intentsQuery.eq('connection_id', filters.connectionId)

  const { data: intents, error: intentsError } = await intentsQuery
  if (intentsError) throw intentsError
  if (!intents?.length) return []

  const signalIds = [...new Set(intents.map((intent) => intent.signal_id))]
  const connectionIds = [...new Set(intents.map((intent) => intent.connection_id))]
  const [signalsResult, connectionsResult, policiesResult] = await Promise.all([
    admin.from('broker_signals')
      .select('id, strategy_code, symbol, action, direction, signal_time, reference_price')
      .in('id', signalIds),
    admin.from('broker_connections').select('id, label').in('id', connectionIds),
    admin.from('broker_risk_policies')
      .select('connection_id, fixed_notional_usd, suggested_notional_per_order_usd')
      .in('connection_id', connectionIds),
  ])
  const firstError = signalsResult.error || connectionsResult.error || policiesResult.error
  if (firstError) throw firstError

  const signalsById = new Map<string, SignalRow>(
    (signalsResult.data ?? []).map((signal) => [signal.id, signal as SignalRow]),
  )

  // Ventana de cierres posteriores acotada a la apertura rechazada más antigua del lote.
  const oldest = (signalsResult.data ?? [])
    .map((signal) => new Date(signal.signal_time).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0]
  const strategyCodes = [...new Set((signalsResult.data ?? []).map((signal) => signal.strategy_code))]
  const laterSignals = oldest && strategyCodes.length
    ? await admin.from('broker_signals')
        .select('id, strategy_code, symbol, action, direction, signal_time, reference_price')
        .eq('action', 'CLOSE')
        .in('strategy_code', strategyCodes)
        .gte('signal_time', new Date(oldest).toISOString())
        .order('signal_time', { ascending: true })
        .limit(1_000)
    : { data: [], error: null }
  if (laterSignals.error) throw laterSignals.error

  const notionalByConnection = new Map(
    (policiesResult.data ?? []).map((policy) => [
      policy.connection_id,
      Number(policy.fixed_notional_usd) || Number(policy.suggested_notional_per_order_usd) || null,
    ]),
  )
  const connections = new Map(
    (connectionsResult.data ?? []).map((connection) => [
      connection.id,
      { label: connection.label, notionalUsd: notionalByConnection.get(connection.id) ?? null },
    ]),
  )

  return buildMissedOpportunities({
    intents: intents as IntentRow[],
    signalsById,
    laterSignals: (laterSignals.data ?? []) as SignalRow[],
    connections,
  })
}
