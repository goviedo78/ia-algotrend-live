import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { loadConnectionOpeningState } from '@/lib/brokers/opening-state'
import { assertDailyLossAllowsOpening } from '@/lib/brokers/daily-loss'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const { id } = await context.params
    if (!UUID.test(id)) {
      throw new BrokerPlatformError('INVALID_INTENT_ID', 'La operación fallida no es válida.', 400)
    }

    const admin = createAdminClient()
    const { data: intent, error: intentError } = await admin.from('broker_order_intents')
      .select('connection_id').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (intentError) throw intentError
    if (!intent) throw new BrokerPlatformError('INTENT_NOT_FOUND', 'Operación no encontrada.', 404)
    await requireOwnedConnection(intent.connection_id, user.id)
    // Do not accept a retry we already know will be rejected. The worker checks again at execution.
    const state = await loadConnectionOpeningState(intent.connection_id)
    assertDailyLossAllowsOpening(state.dailyLoss)

    const { data: connectionId, error } = await admin.rpc('retry_broker_missed_open', {
      target_intent_id: id,
      expected_user_id: user.id,
    })
    if (error || typeof connectionId !== 'string') {
      throw new BrokerPlatformError(
        'MISSED_OPEN_NOT_RETRYABLE',
        'La operación ya cerró, está en proceso o no se puede reenviar.',
        409,
      )
    }

    await writeBrokerAudit({
      request,
      userId: user.id,
      actorUserId: user.id,
      connectionId,
      eventType: 'MISSED_OPEN_RETRY_REQUESTED',
      outcome: 'SUCCESS',
      metadata: { intentId: id },
    })
    after(() => safeProcessBrokerJobsInApp({ batchSize: 4, maxBatches: 2 }).then(() => undefined))
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
