import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { encryptCredentials } from '@/lib/brokers/crypto'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { assertBrokerConnectionCanBeConfigured } from '@/lib/brokers/connection-lifecycle'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { rotateCredentialsSchema } from '@/lib/brokers/schemas'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const parsed = rotateCredentialsSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_CREDENTIALS', 'Las credenciales no son válidas.', 400)
    const { id } = await context.params
    const connection = await requireOwnedConnection(id, user.id)
    if (connection.status !== 'SUSPENDED') {
      throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'Suspendé la conexión y cerrá sus posiciones antes de cambiar la API.', 409)
    }
    await assertBrokerConnectionCanBeConfigured(id)

    const admin = createAdminClient()
    const { data: currentEnvelope } = await admin
      .from('broker_credential_envelopes')
      .select('version')
      .eq('connection_id', id)
      .maybeSingle()
    const version = Number(currentEnvelope?.version ?? 0) + 1
    const envelope = await encryptCredentials(
      { apiKey: parsed.data.apiKey, secretKey: parsed.data.secretKey },
      { connectionId: id, userId: user.id, broker: connection.broker, environment: connection.environment, version },
    )
    const { error: envelopeError } = await admin.from('broker_credential_envelopes').upsert({
      connection_id: id,
      ciphertext: envelope.ciphertext,
      encrypted_data_key: envelope.encryptedDataKey,
      iv: envelope.iv,
      auth_tag: envelope.authTag,
      aad: envelope.aad,
      kms_key_id: envelope.kmsKeyId,
      algorithm: envelope.algorithm,
      version,
      rotated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id' })
    if (envelopeError) throw envelopeError
    await Promise.all([
      admin.from('broker_connections').update({ status: 'PENDING_VALIDATION', validated_at: null, last_error_code: null }).eq('id', id),
      admin.from('broker_risk_policies').update({ enabled: false }).eq('connection_id', id),
      admin.from('broker_strategy_bindings').update({ enabled: false }).eq('connection_id', id),
      admin.from('broker_execution_jobs').insert({ connection_id: id, job_type: 'VALIDATE_CONNECTION' }),
    ])
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'CREDENTIALS_ROTATED', outcome: 'SUCCESS', metadata: { version } })
    after(() => safeProcessBrokerJobsInApp({ batchSize: 2 }).then(() => undefined))
    return NextResponse.json({ ok: true, status: 'PENDING_VALIDATION' }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
