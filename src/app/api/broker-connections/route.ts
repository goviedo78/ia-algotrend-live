import { randomUUID } from 'node:crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerMember } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { encryptCredentials } from '@/lib/brokers/crypto'
import { connectionDto } from '@/lib/brokers/dto'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { connectionCreateSchema } from '@/lib/brokers/schemas'
import { deriveRiskSuggestion } from '@/lib/brokers/risk-profiles'
import { brokerStrategy } from '@/lib/brokers/strategies'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CONNECTION_SELECT = `
  id, broker, environment, label, status, permissions_confirmed,
  requested_strategy_code, requested_symbol, requested_timeframe,
  ip_restriction_confirmed, validated_at, last_health_check_at,
  last_error_code, created_at,
  broker_risk_policies (*),
  broker_strategy_bindings (*)
`

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireBrokerMember({ allowPending: true })
    await enforceBrokerRateLimit('connection_read', requestIdentifier(request, user.id))
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('broker_connections')
      .select(CONNECTION_SELECT)
      .eq('user_id', user.id)
      .neq('status', 'DELETED')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({
      connections: (data ?? []).map((row) => connectionDto(row as unknown as Record<string, unknown>)),
      executionMode: 'APP_SERVERLESS',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function POST(request: NextRequest) {
  let connectionId: string | null = null
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerMember()
    await enforceBrokerRateLimit('connection_write', requestIdentifier(request, user.id))
    const parsed = connectionCreateSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_CONNECTION', 'Los datos de la conexión no son válidos.', 400)
    if (parsed.data.broker !== 'BINGX') throw new BrokerPlatformError('BROKER_NOT_IMPLEMENTED', 'Este broker todavía no está habilitado.', 422)
    const strategy = brokerStrategy(parsed.data.strategyCode)
    if (!strategy) throw new BrokerPlatformError('STRATEGY_NOT_SUPPORTED', 'La estrategia seleccionada no está habilitada.', 422)
    connectionId = randomUUID()
    const envelope = await encryptCredentials(
      { apiKey: parsed.data.apiKey, secretKey: parsed.data.secretKey },
      { connectionId, userId: user.id, broker: parsed.data.broker, environment: parsed.data.environment, version: 1 },
    )
    const admin = createAdminClient()
    const suggestion = deriveRiskSuggestion(parsed.data.capitalUsd, parsed.data.riskProfile, parsed.data.allocationPct)
    const { error: connectionError } = await admin.from('broker_connections').insert({
      id: connectionId,
      user_id: user.id,
      broker: parsed.data.broker,
      environment: parsed.data.environment,
      label: parsed.data.label,
      requested_strategy_code: strategy.code,
      requested_symbol: strategy.symbol,
      requested_timeframe: strategy.timeframe,
      status: 'PENDING_VALIDATION',
      permissions_confirmed: parsed.data.permissions,
      ip_restriction_confirmed: parsed.data.ipRestrictionConfirmed,
    })
    if (connectionError) throw connectionError

    const { error: envelopeError } = await admin.from('broker_credential_envelopes').insert({
      connection_id: connectionId,
      ciphertext: envelope.ciphertext,
      encrypted_data_key: envelope.encryptedDataKey,
      iv: envelope.iv,
      auth_tag: envelope.authTag,
      aad: envelope.aad,
      kms_key_id: envelope.kmsKeyId,
      algorithm: envelope.algorithm,
      version: envelope.version,
    })
    if (envelopeError) throw envelopeError

    const [{ error: riskError }, { error: jobError }] = await Promise.all([
      admin.from('broker_risk_policies').insert({
        connection_id: connectionId,
        sizing_mode: parsed.data.sizingMode,
        declared_capital_usd: suggestion.declaredCapitalUsd,
        risk_profile: suggestion.riskProfile,
        exposure_per_order_pct: suggestion.exposurePerOrderPct,
        max_total_exposure_pct: suggestion.maxTotalExposurePct,
        daily_loss_limit_pct: suggestion.dailyLossLimitPct,
        margin_reserve_pct: suggestion.marginReservePct,
        suggested_notional_per_order_usd: suggestion.suggestedNotionalPerOrderUsd,
        suggested_max_total_exposure_usd: suggestion.suggestedMaxTotalExposureUsd,
        suggested_daily_loss_limit_usd: suggestion.suggestedDailyLossLimitUsd,
        suggested_min_available_margin_usd: suggestion.suggestedMinAvailableMarginUsd,
      }),
      admin.from('broker_execution_jobs').insert({ connection_id: connectionId, job_type: 'VALIDATE_CONNECTION' }),
    ])
    if (riskError || jobError) throw riskError || jobError

    await writeBrokerAudit({ request, userId: user.id, actorUserId: user.id, connectionId, eventType: 'CONNECTION_CREATED', outcome: 'SUCCESS', metadata: { broker: parsed.data.broker, environment: parsed.data.environment, strategyCode: strategy.code, symbol: strategy.symbol, timeframe: strategy.timeframe } })
    after(() => safeProcessBrokerJobsInApp({ batchSize: 2 }).then(() => undefined))
    return NextResponse.json({ id: connectionId, status: 'PENDING_VALIDATION' }, { status: 202 })
  } catch (error) {
    if (connectionId) {
      await createAdminClient().from('broker_connections').delete().eq('id', connectionId)
    }
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
