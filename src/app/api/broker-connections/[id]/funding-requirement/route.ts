import { NextRequest, NextResponse } from 'next/server'
import { loadBrokerAdapter } from '@/lib/brokers/adapter-loader'
import { requireBrokerMember } from '@/lib/brokers/auth'
import { riskPolicyFromRow } from '@/lib/brokers/dto'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { calculateOpeningFundingRequirement } from '@/lib/brokers/funding-requirement'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const { id } = await context.params
    await requireOwnedConnection(id, user.id)

    const admin = createAdminClient()
    const [{ adapter }, policyResult, runtimeResult] = await Promise.all([
      loadBrokerAdapter(id),
      admin.from('broker_risk_policies').select('*').eq('connection_id', id).maybeSingle(),
      admin.rpc('get_broker_risk_runtime', { target_connection_id: id }),
    ])
    if (policyResult.error || runtimeResult.error) throw policyResult.error || runtimeResult.error
    const policy = riskPolicyFromRow(policyResult.data)
    if (!policy) throw new BrokerPlatformError('RISK_POLICY_MISSING', 'La conexión no tiene política de riesgo.', 409)

    const [balance, commissionRates] = await Promise.all([
      adapter.getBalance(),
      adapter.getCommissionRates(),
    ])
    const runtime = Array.isArray(runtimeResult.data) ? runtimeResult.data[0] : runtimeResult.data
    const sizingCapitalUsd = Math.max(0, Math.min(
      balance.equity,
      Number(runtime?.compound_capital_usd ?? policy.declaredCapitalUsd),
    ))
    const targetNotionalUsd = policy.sizingMode === 'EQUITY_PERCENT'
      ? sizingCapitalUsd * policy.exposurePerOrderPct / 100
      : policy.fixedNotionalUsd
    const reserveUsd = policy.sizingMode === 'EQUITY_PERCENT'
      ? sizingCapitalUsd * policy.marginReservePct / 100
      : policy.minAvailableMarginUsd
    const funding = calculateOpeningFundingRequirement({
      notionalUsd: targetNotionalUsd,
      leverage: policy.maxLeverage,
      reserveUsd,
      takerFeeRate: commissionRates.taker,
    })

    return NextResponse.json({
      connectionId: id,
      sizingMode: policy.sizingMode,
      targetNotionalUsd,
      leverage: policy.maxLeverage,
      takerFeeRate: commissionRates.taker,
      availableMarginUsd: balance.availableMargin,
      ...funding,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
