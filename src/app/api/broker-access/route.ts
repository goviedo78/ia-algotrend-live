import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireAal2User } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAal2User()
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('broker_memberships')
      .select('status, requested_at, reviewed_at, review_note')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ membership: data ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { user } = await requireAal2User()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('broker_memberships')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing?.status === 'REVOKED') {
      return NextResponse.json({ error: 'MEMBERSHIP_REVOKED', message: 'El acceso fue revocado.' }, { status: 403 })
    }
    const { error } = await admin.from('broker_memberships').upsert({
      user_id: user.id,
      status: existing?.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      requested_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, eventType: 'MEMBERSHIP_REQUESTED', outcome: 'SUCCESS' })
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
