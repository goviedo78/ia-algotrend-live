import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBrokerAdmin } from '@/lib/brokers/auth'
import { publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { brokerExecutionMode } from '@/lib/brokers/runtime'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerAdmin(['admin_readonly', 'broker_operator', 'security_admin'])
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const [
      { count: queuedJobs, error: queuedError },
      { count: processingJobs, error: processingError },
      { count: failedJobs, error: failedError },
      { data: oldestQueued, error: oldestError },
      { data: recentExecutions, error: executionsError },
      { count: goldOutboxPending, error: goldOutboxPendingError },
      { count: goldOutboxFailed, error: goldOutboxFailedError },
      { count: goldOutboxUnrouted, error: goldOutboxUnroutedError },
    ] = await Promise.all([
      admin.from('broker_execution_jobs').select('*', { count: 'exact', head: true }).in('status', ['QUEUED', 'RETRY']),
      admin.from('broker_execution_jobs').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      admin.from('broker_execution_jobs').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DEAD_LETTER']),
      admin.from('broker_execution_jobs').select('created_at').in('status', ['QUEUED', 'RETRY']).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      admin.from('broker_execution_jobs').select('created_at, updated_at').eq('job_type', 'EXECUTE_ORDER').eq('status', 'COMPLETED').order('updated_at', { ascending: false }).limit(100),
      admin.from('gold30_broker_outbox').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      admin.from('gold30_broker_outbox').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
      admin.from('gold30_broker_outbox').select('*', { count: 'exact', head: true }).eq('status', 'SENT').eq('last_error_code', 'NO_ELIGIBLE_CONNECTION'),
    ])
    if (queuedError || processingError || failedError || oldestError || executionsError || goldOutboxPendingError || goldOutboxFailedError || goldOutboxUnroutedError) {
      throw queuedError || processingError || failedError || oldestError || executionsError || goldOutboxPendingError || goldOutboxFailedError || goldOutboxUnroutedError
    }
    const completedDurations = (recentExecutions ?? [])
      .map((job) => new Date(job.updated_at).getTime() - new Date(job.created_at).getTime())
      .filter((duration) => Number.isFinite(duration) && duration >= 0)
      .sort((a, b) => a - b)
    const p95Index = Math.max(0, Math.ceil(completedDurations.length * 0.95) - 1)
    const executionMode = brokerExecutionMode()
    return NextResponse.json({
      runtime: {
        mode: 'APP_SERVERLESS',
        encryptionConfigured: Boolean(
          process.env.BROKER_ENVELOPE_PUBLIC_KEY_B64?.trim()
          && process.env.BROKER_ENVELOPE_PRIVATE_KEY_B64?.trim(),
        ),
        ...executionMode,
        queuedJobs: queuedJobs ?? 0,
        processingJobs: processingJobs ?? 0,
        failedJobs: failedJobs ?? 0,
        goldOutboxPending: goldOutboxPending ?? 0,
        goldOutboxFailed: goldOutboxFailed ?? 0,
        goldOutboxUnrouted: goldOutboxUnrouted ?? 0,
        oldestQueuedAgeSeconds: oldestQueued
          ? Math.max(0, Math.round((Date.now() - new Date(oldestQueued.created_at).getTime()) / 1_000))
          : null,
        lastCompletedExecutionAt: recentExecutions?.[0]?.updated_at ?? null,
        p95OrderJobLatencyMs: completedDurations.length ? completedDurations[p95Index] : null,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
