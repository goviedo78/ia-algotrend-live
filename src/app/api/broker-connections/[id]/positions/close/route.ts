import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { manualPositionCloseSchema } from '@/lib/brokers/schemas'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

/**
 * Cierre a pedido del titular sobre una posición que ESTA conexión abrió.
 *
 * Va por el mismo camino que un cierre de estrategia: intención, cola y motor de riesgo con
 * `reduceOnly` y control de ownership. Si el broker ya no tiene la posición porque el titular
 * la cerró a mano, el motor asienta el cierre externo y la posición deja de figurar abierta.
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const parsed = manualPositionCloseSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) {
      throw new BrokerPlatformError('INVALID_POSITION', 'La posición indicada no es válida.', 400)
    }
    const { id } = await context.params
    const connection = await requireOwnedConnection(id, user.id)

    const { data: intentId, error } = await createAdminClient().rpc('request_manual_position_close', {
      target_connection_id: connection.id,
      expected_user_id: user.id,
      target_symbol: parsed.data.symbol,
      target_direction: parsed.data.direction,
    })
    if (error || typeof intentId !== 'string') {
      throw new BrokerPlatformError(
        'MANUAL_CLOSE_NOT_AVAILABLE',
        'No se pudo encolar el cierre: la posición ya no está abierta en esta conexión o hay otra orden en curso.',
        409,
      )
    }

    await writeBrokerAudit({
      request,
      userId: user.id,
      actorUserId: user.id,
      connectionId: connection.id,
      eventType: 'MANUAL_POSITION_CLOSE_REQUESTED',
      outcome: 'SUCCESS',
      metadata: { intentId, symbol: parsed.data.symbol, direction: parsed.data.direction },
    })
    after(() => safeProcessBrokerJobsInApp({ batchSize: 4, maxBatches: 2 }).then(() => undefined))
    return NextResponse.json({ ok: true, intentId }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
