import { NextRequest, NextResponse } from 'next/server'
import { requireBrokerAdmin } from '@/lib/brokers/auth'
import { publicError } from '@/lib/brokers/errors'
import { loadBrokerOrderHistory } from '@/lib/brokers/order-history'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerAdmin(['admin_readonly', 'broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const connectionId = request.nextUrl.searchParams.get('connectionId')
    const userId = request.nextUrl.searchParams.get('userId')
    if ((connectionId && !UUID.test(connectionId)) || (userId && !UUID.test(userId))) {
      return NextResponse.json({ code: 'INVALID_FILTER', message: 'Filtro inválido.' }, { status: 400 })
    }
    const history = await loadBrokerOrderHistory({
      connectionId: connectionId ?? undefined,
      userId: userId ?? undefined,
      includeUserEmails: true,
      limit: 200,
    })
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
