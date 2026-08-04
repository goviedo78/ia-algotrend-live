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
    // El titular fija el lotaje en USD. La exposición total nunca puede quedar por debajo de una
    // sola orden: la RPC rechaza `max_total_exposure_usd < notional_per_order_usd`, y el motor
    // rechazaría igual la apertura con RISK_TOTAL_EXPOSURE_LIMIT.
    const maxTotalExposureUsd = Math.max(suggestion.suggestedMaxTotalExposureUsd, fixedNotionalUsd)
    if (fixedNotionalUsd > suggestion.declaredCapitalUsd) {
      throw new BrokerPlatformError('INVALID_RISK_PROPOSAL', 'El lotaje por orden no puede superar el capital autorizado de la conexión.', 400)
    }
    if (dailyLossLimitUsd > suggestion.declaredCapitalUsd) {
      throw new BrokerPlatformError('INVALID_RISK_PROPOSAL', 'La pérdida máxima diaria no puede superar el capital autorizado de la conexión.', 400)
    }
    // La reserva de margen se acota al capital declarado menos la orden autorizada; si no,
    // el motor bloquea cada apertura con RISK_MARGIN_RESERVE.
    const minAvailableMarginUsd = Math.max(0, Math.min(suggestion.suggestedMinAvailableMarginUsd, suggestion.declaredCapitalUsd - fixedNotionalUsd))
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
    })
    if (error || !['ACTIVE', 'PENDING_APPROVAL'].includes(String(data))) {
      throw new BrokerPlatformError('RISK_CHANGE_FAILED', 'No se pudo guardar la propuesta de riesgo.', 409)
    }
    const finalStatus = String(data)
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'RISK_CHANGE_REQUESTED', outcome: 'SUCCESS', metadata: { previousStatus: connection.status, newStatus: finalStatus, sizingMode: parsed.data.sizingMode, capitalUsd: suggestion.declaredCapitalUsd, allocationPct: suggestion.exposurePerOrderPct, notionalPerOrderUsd: fixedNotionalUsd, dailyLossLimitUsd, maxTotalExposureUsd, minAvailableMarginUsd } })
    return NextResponse.json({ ok: true, status: finalStatus })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
