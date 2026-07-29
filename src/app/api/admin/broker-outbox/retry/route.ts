import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerAdmin } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerAdmin(['broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('admin_write', requestIdentifier(request, user.id))
    const { data, error } = await createAdminClient().from('gold30_broker_outbox').update({
      status: 'PENDING',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    }).eq('status', 'FAILED').select('id')
    if (error) throw error
    await writeBrokerAudit({ request, actorUserId: user.id, eventType: 'GOLD30_OUTBOX_REQUEUED', outcome: 'SUCCESS', metadata: { count: data?.length ?? 0 } })
    return NextResponse.json({ ok: true, requeued: data?.length ?? 0 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
