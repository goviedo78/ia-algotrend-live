import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const { data: connectionId, error } = await createAdminClient().rpc('retry_broker_missed_open', {
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
