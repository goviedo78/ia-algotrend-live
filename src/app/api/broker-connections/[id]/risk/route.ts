import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { assertBrokerConnectionCanBeConfigured, suspendBrokerConnectionForEdit } from '@/lib/brokers/connection-lifecycle'
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
    if (connection.status !== 'PENDING_APPROVAL') {
      await suspendBrokerConnectionForEdit(id, user.id)
      if (connection.status === 'ACTIVE') {
        await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_SUSPENDED_FOR_EDIT', outcome: 'SUCCESS' })
      }
    }
    await assertBrokerConnectionCanBeConfigured(id)
    const suggestion = deriveRiskSuggestion(parsed.data.capitalUsd, parsed.data.riskProfile, parsed.data.allocationPct)
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
      proposal_notional_per_order_usd: suggestion.suggestedNotionalPerOrderUsd,
      proposal_max_total_exposure_usd: suggestion.suggestedMaxTotalExposureUsd,
      proposal_daily_loss_limit_usd: suggestion.suggestedDailyLossLimitUsd,
      proposal_min_available_margin_usd: suggestion.suggestedMinAvailableMarginUsd,
    })
    if (error || !['ACTIVE', 'PENDING_APPROVAL'].includes(String(data))) {
      throw new BrokerPlatformError('RISK_CHANGE_FAILED', 'No se pudo guardar la propuesta de riesgo.', 409)
    }
    const finalStatus = String(data)
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'RISK_CHANGE_REQUESTED', outcome: 'SUCCESS', metadata: { previousStatus: connection.status, newStatus: finalStatus, sizingMode: parsed.data.sizingMode, capitalUsd: suggestion.declaredCapitalUsd, allocationPct: suggestion.exposurePerOrderPct } })
    return NextResponse.json({ ok: true, status: finalStatus })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
