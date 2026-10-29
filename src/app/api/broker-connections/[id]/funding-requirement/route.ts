import { NextRequest, NextResponse } from 'next/server'
import { requireBrokerMember } from '@/lib/brokers/auth'
import { publicError } from '@/lib/brokers/errors'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

import { loadConnectionOpeningState } from '@/lib/brokers/opening-state'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const { id } = await context.params
    await requireOwnedConnection(id, user.id)

    const { policy, plan, dailyLoss, availableMarginUsd, takerFeeRate, sizingCapitalUsd } = await loadConnectionOpeningState(id)
    const { targetNotionalUsd, notionalUsd, limitedByBalance, ...funding } = plan

    return NextResponse.json({
      connectionId: id,
      sizingMode: policy.sizingMode,
      targetNotionalUsd: notionalUsd,
      configuredNotionalUsd: targetNotionalUsd,
      limitedByBalance,
      leverage: policy.maxLeverage,
      takerFeeRate,
      availableMarginUsd,
      sizingCapitalUsd,
      dailyLoss,
      ...funding,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
