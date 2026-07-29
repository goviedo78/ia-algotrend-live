import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const { id } = await context.params
    const connection = await requireOwnedConnection(id, user.id)
    if (['REVOKED', 'DELETED', 'MANUAL_INTERVENTION_REQUIRED'].includes(connection.status)) {
      throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'La conexión no se puede validar.', 409)
    }
    const admin = createAdminClient()
    const { count } = await admin.from('broker_credential_envelopes').select('*', { count: 'exact', head: true }).eq('connection_id', id)
    if (!count) throw new BrokerPlatformError('CREDENTIALS_MISSING', 'La conexión no tiene credenciales activas.', 409)
    await Promise.all([
      admin.from('broker_connections').update({ status: 'PENDING_VALIDATION', last_error_code: null }).eq('id', id),
      admin.from('broker_execution_jobs').insert({ connection_id: id, job_type: 'VALIDATE_CONNECTION' }),
    ])
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_REVALIDATION_REQUESTED', outcome: 'SUCCESS' })
    after(() => safeProcessBrokerJobsInApp({ batchSize: 2 }).then(() => undefined))
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
