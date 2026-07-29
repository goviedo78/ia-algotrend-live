import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { revokeBrokerConnection, softDeleteBrokerConnection } from '@/lib/brokers/connection-lifecycle'
import { canDeleteConnection } from '@/lib/brokers/domain'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { requireOwnedConnection } from '@/lib/brokers/ownership'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { connectionActionSchema } from '@/lib/brokers/schemas'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember({ allowPending: true })
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const parsed = connectionActionSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_ACTION', 'Acción inválida.', 400)
    const { id } = await context.params
    const connection = await requireOwnedConnection(id, user.id)
    const admin = createAdminClient()

    if (parsed.data.action === 'SUSPEND') {
      if (connection.status === 'SUSPENDED') {
        return NextResponse.json({ ok: true, status: 'SUSPENDED' })
      }
      if (connection.status !== 'ACTIVE') {
        throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'La conexión no se puede suspender en su estado actual.', 409)
      }
      const { data: suspended, error } = await admin.from('broker_connections').update({
        status: 'SUSPENDED',
        suspended_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id).eq('status', 'ACTIVE').select('id').maybeSingle()
      if (error) throw error
      if (!suspended) throw new BrokerPlatformError('CONNECTION_STATE_CHANGED', 'La conexión cambió de estado. Actualizá la página.', 409)
      const { error: riskError } = await admin.from('broker_risk_policies').update({ enabled: false }).eq('connection_id', id)
      if (riskError) throw new BrokerPlatformError('CONNECTION_SUSPEND_INCOMPLETE', 'La conexión fue suspendida, pero no se pudo actualizar el riesgo.', 503, true)
      await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_SUSPENDED', outcome: 'SUCCESS' })
      return NextResponse.json({ ok: true, status: 'SUSPENDED' })
    }

    const result = await revokeBrokerConnection(connection)
    await writeBrokerAudit({
      request,
      userId: user.id,
      actorUserId: user.id,
      connectionId: id,
      eventType: 'CONNECTION_REVOKED',
      outcome: 'SUCCESS',
      metadata: {
        finalStatus: result.status,
        positionCheck: result.positionCheck,
        openPositionCount: result.openPositionCount,
        checkErrorCode: result.checkErrorCode,
      },
    })
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember({ allowPending: true })
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: connection, error: lookupError } = await admin
      .from('broker_connections')
      .select('id, user_id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!connection) throw new BrokerPlatformError('CONNECTION_NOT_FOUND', 'Conexión no encontrada.', 404)
    if (connection.status === 'DELETED') return NextResponse.json({ ok: true })
    if (!canDeleteConnection(connection.status)) {
      throw new BrokerPlatformError('CONNECTION_DELETE_BLOCKED', 'Primero revocá la conexión y cerrá cualquier posición pendiente.', 409)
    }
    const finalStatus = await softDeleteBrokerConnection(id, user.id)
    if (finalStatus !== 'DELETED') {
      throw new BrokerPlatformError('CONNECTION_DELETE_BLOCKED', 'La conexión cambió de estado. Actualizá la página.', 409)
    }
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_DELETED', outcome: 'SUCCESS' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
