import { NextRequest, NextResponse } from 'next/server'
import { requireBrokerMember } from '@/lib/brokers/auth'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { loadBrokerOrderHistory } from '@/lib/brokers/order-history'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerMember({ allowPending: true })
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const connectionId = request.nextUrl.searchParams.get('connectionId')
    const history = await loadBrokerOrderHistory({ userId: user.id, connectionId: connectionId ?? undefined })
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
