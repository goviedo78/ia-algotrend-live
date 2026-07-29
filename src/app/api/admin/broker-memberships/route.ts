import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBrokerAdmin } from '@/lib/brokers/auth'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerAdmin(['admin_readonly', 'broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const [{ data: memberships, error }, { data: profiles }] = await Promise.all([
      admin.from('broker_memberships').select('*').order('requested_at', { ascending: false }).limit(200),
      admin.from('profiles').select('id, email').limit(1000),
    ])
    if (error) throw error
    const emails = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]))
    return NextResponse.json({
      memberships: (memberships ?? []).map((membership) => ({
        userId: membership.user_id,
        email: emails.get(membership.user_id) ?? null,
        status: membership.status,
        requestedAt: membership.requested_at,
        reviewedAt: membership.reviewed_at,
        reviewNote: membership.review_note,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
