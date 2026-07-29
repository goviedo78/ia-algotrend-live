import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBrokerAdmin } from '@/lib/brokers/auth'
import { connectionDto } from '@/lib/brokers/dto'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerAdmin(['admin_readonly', 'broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const [{ data: connections, error }, { data: profiles }] = await Promise.all([
      admin.from('broker_connections').select(`
        id, user_id, broker, environment, label, status, permissions_confirmed,
        requested_strategy_code, requested_symbol, requested_timeframe,
        ip_restriction_confirmed, validated_at, last_health_check_at,
        last_error_code, created_at, broker_risk_policies (*), broker_strategy_bindings (*)
      `).neq('status', 'DELETED').order('created_at', { ascending: false }).limit(200),
      admin.from('profiles').select('id, email').limit(1000),
    ])
    if (error) throw error
    const emails = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]))
    return NextResponse.json({
      connections: (connections ?? []).map((row) => ({
        ...connectionDto(row as unknown as Record<string, unknown>),
        userId: row.user_id,
        email: emails.get(row.user_id) ?? null,
      })),
      executionMode: 'APP_SERVERLESS',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
