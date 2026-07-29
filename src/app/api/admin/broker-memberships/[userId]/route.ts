import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerAdmin } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { revokeBrokerConnection } from '@/lib/brokers/connection-lifecycle'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { membershipReviewSchema } from '@/lib/brokers/schemas'

type Context = { params: Promise<{ userId: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerAdmin(['broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('admin_write', requestIdentifier(request, user.id))
    const parsed = membershipReviewSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_MEMBERSHIP_REVIEW', 'Revisión inválida.', 400)
    const { userId } = await context.params
    const admin = createAdminClient()
    if (parsed.data.status !== 'ACTIVE') {
      let connectionQuery = admin.from('broker_connections').select('id, user_id, status').eq('user_id', userId)
      connectionQuery = parsed.data.status === 'REVOKED'
        ? connectionQuery.neq('status', 'DELETED')
        : connectionQuery.eq('status', 'ACTIVE')
      const { data: connections, error: connectionLookupError } = await connectionQuery
      if (connectionLookupError) throw connectionLookupError
      if (parsed.data.status === 'REVOKED') {
        for (const connection of connections ?? []) {
          await revokeBrokerConnection(connection)
        }
      } else {
        const ids = (connections ?? []).map((connection) => connection.id)
        if (ids.length) {
          const { error: suspendError } = await admin.from('broker_connections').update({
            status: 'SUSPENDED',
            suspended_at: new Date().toISOString(),
          }).in('id', ids).eq('status', 'ACTIVE')
          if (suspendError) throw suspendError
          const { error: riskError } = await admin.from('broker_risk_policies').update({ enabled: false }).in('connection_id', ids)
          if (riskError) throw riskError
        }
      }
    }
    const { data, error } = await admin.from('broker_memberships').update({
      status: parsed.data.status,
      review_note: parsed.data.note ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('user_id', userId).select('user_id').maybeSingle()
    if (error) throw error
    if (!data) throw new BrokerPlatformError('MEMBERSHIP_NOT_FOUND', 'Solicitud no encontrada.', 404)
    await writeBrokerAudit({ request, userId, actorUserId: user.id, eventType: 'MEMBERSHIP_REVIEWED', outcome: 'SUCCESS', metadata: { status: parsed.data.status } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
