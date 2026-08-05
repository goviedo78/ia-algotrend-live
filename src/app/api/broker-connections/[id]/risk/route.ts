import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { deriveRiskSuggestion } from '@/lib/brokers/risk-profiles'
import { riskChangeSchema } from '@/lib/brokers/schemas'

type Context = { params: Promise<{ id: string }> }

// Un campo omitido conserva lo que la conexión ya tenía: editar el lotaje no debe resetear
// las posiciones simultáneas ni el apalancamiento a un default.
async function loadCurrentRiskPolicy(connectionId: string) {
  const { data } = await createAdminClient()
    .from('broker_risk_policies')
    .select('max_open_positions, max_orders_per_minute, max_leverage')
    .eq('connection_id', connectionId)
    .maybeSingle()
  return {
    maxOpenPositions: Number(data?.max_open_positions) || 1,
    maxOrdersPerMinute: Number(data?.max_orders_per_minute) || 2,
    maxLeverage: Number(data?.max_leverage) || 1,
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const parsed = riskChangeSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_RISK_PROPOSAL', 'La propuesta de riesgo no es válida.', 400)
    const { id } = await context.params
    const connection = await requireOwnedConnection(id, user.id)
    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(connection.status)) {
      throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'La conexión debe estar activa o suspendida para editar su capital.', 409)
    }
    const suggestion = deriveRiskSuggestion(parsed.data.capitalUsd, parsed.data.riskProfile, parsed.data.allocationPct)
    const fixedNotionalUsd = parsed.data.fixedNotionalUsd ?? suggestion.suggestedNotionalPerOrderUsd
    const dailyLossLimitUsd = parsed.data.dailyLossLimitUsd ?? suggestion.suggestedDailyLossLimitUsd
    // El titular decide su lotaje y su pérdida diaria sin techo nuestro: el único límite real es
    // el margen que tenga en el broker. Estos dos ajustes NO son restricciones, son coherencia
    // interna — sin ellos la propia propuesta del usuario se auto-bloquearía:
    //  - la RPC rechaza `max_total_exposure_usd < notional_per_order_usd`;
    //  - el motor rechaza con RISK_MARGIN_RESERVE si la reserva se solapa con la orden.
    // El titular puede fijar cada parámetro a mano. Si no lo manda, se conserva lo que ya tenía
    // la política; y si nunca tuvo valor, se cae en el derivado del perfil.
    const currentPolicy = await loadCurrentRiskPolicy(id)
    const maxTotalExposureUsd = parsed.data.maxTotalExposureUsd
      ?? Math.max(suggestion.suggestedMaxTotalExposureUsd, fixedNotionalUsd)
    const minAvailableMarginUsd = parsed.data.minAvailableMarginUsd
      ?? Math.max(0, Math.min(suggestion.suggestedMinAvailableMarginUsd, suggestion.declaredCapitalUsd - fixedNotionalUsd))
    const maxOpenPositions = parsed.data.maxOpenPositions ?? Math.max(1, currentPolicy.maxOpenPositions)
    const maxOrdersPerMinute = parsed.data.maxOrdersPerMinute ?? Math.max(1, currentPolicy.maxOrdersPerMinute)
    const maxLeverage = parsed.data.maxLeverage ?? Math.max(1, currentPolicy.maxLeverage)
    // Tope global de apalancamiento: es configuración del dueño de la plataforma
    // (BROKER_MAX_ALLOWED_LEVERAGE), la misma que ya aplica la ruta de administración.
    const globalMaxLeverage = Math.max(1, Number(process.env.BROKER_MAX_ALLOWED_LEVERAGE ?? 1))
    if (maxLeverage > globalMaxLeverage) {
      throw new BrokerPlatformError(
        'LEVERAGE_ABOVE_PLATFORM_LIMIT',
        `El apalancamiento máximo permitido por la plataforma es ${globalMaxLeverage}x. Subí BROKER_MAX_ALLOWED_LEVERAGE para ampliarlo.`,
        400,
      )
    }
    // La exposición total nunca puede quedar por debajo de una sola orden: la RPC la rechaza y
    // el motor tampoco podría abrir. No es un techo, es coherencia de la propia propuesta.
    if (maxTotalExposureUsd < fixedNotionalUsd) {
      throw new BrokerPlatformError(
        'INVALID_RISK_PROPOSAL',
        'La exposición total no puede ser menor que el lotaje por orden.',
        400,
      )
    }
    const { data, error } = await createAdminClient().rpc('request_broker_risk_change', {
      target_connection_id: id,
      expected_user_id: user.id,
      proposal_sizing_mode: parsed.data.sizingMode,
      proposal_declared_capital_usd: suggestion.declaredCapitalUsd,
      proposal_risk_profile: suggestion.riskProfile,
      proposal_exposure_per_order_pct: suggestion.exposurePerOrderPct,
      proposal_max_total_exposure_pct: suggestion.maxTotalExposurePct,
      proposal_daily_loss_limit_pct: suggestion.dailyLossLimitPct,
      proposal_margin_reserve_pct: suggestion.marginReservePct,
      proposal_notional_per_order_usd: fixedNotionalUsd,
      proposal_max_total_exposure_usd: maxTotalExposureUsd,
      proposal_daily_loss_limit_usd: dailyLossLimitUsd,
      proposal_min_available_margin_usd: minAvailableMarginUsd,
      proposal_max_open_positions: maxOpenPositions,
      proposal_max_orders_per_minute: maxOrdersPerMinute,
      proposal_max_leverage: maxLeverage,
    })
    if (error || !['ACTIVE', 'PENDING_APPROVAL'].includes(String(data))) {
      throw new BrokerPlatformError('RISK_CHANGE_FAILED', 'No se pudo guardar la propuesta de riesgo.', 409)
    }
    const finalStatus = String(data)
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'RISK_CHANGE_REQUESTED', outcome: 'SUCCESS', metadata: { previousStatus: connection.status, newStatus: finalStatus, sizingMode: parsed.data.sizingMode, capitalUsd: suggestion.declaredCapitalUsd, allocationPct: suggestion.exposurePerOrderPct, notionalPerOrderUsd: fixedNotionalUsd, dailyLossLimitUsd, maxTotalExposureUsd, minAvailableMarginUsd, maxOpenPositions, maxOrdersPerMinute, maxLeverage } })
    return NextResponse.json({ ok: true, status: finalStatus })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
