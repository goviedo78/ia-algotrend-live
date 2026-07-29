import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameOrigin, requireBrokerAdmin } from '@/lib/brokers/auth'
import { writeBrokerAudit } from '@/lib/brokers/audit'
import { assertBrokerConnectionCanBeConfigured, rejectBrokerConnection, revokeBrokerConnection, softDeleteBrokerConnection, suspendBrokerConnectionForEdit } from '@/lib/brokers/connection-lifecycle'
import { canDeleteConnection } from '@/lib/brokers/domain'
import { BrokerPlatformError, publicError } from '@/lib/brokers/errors'
import { enforceBrokerRateLimit, requestIdentifier } from '@/lib/brokers/rate-limit'
import { readBrokerJson } from '@/lib/brokers/request'
import { adminConnectionSchema } from '@/lib/brokers/schemas'
import { safeProcessBrokerJobsInApp } from '@/lib/brokers/worker'
import { brokerStrategy } from '@/lib/brokers/strategies'
import { loadBrokerAdapter } from '@/lib/brokers/adapter-loader'

export const maxDuration = 30

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const parsed = adminConnectionSchema.safeParse(await readBrokerJson(request))
    if (!parsed.success) throw new BrokerPlatformError('INVALID_ADMIN_ACTION', 'Acción administrativa inválida.', 400)
    const requiredRoles = ['REVOKE', 'CONFIRM_MANUAL_RESOLUTION'].includes(parsed.data.action)
      ? ['security_admin'] as const
      : ['broker_operator', 'security_admin'] as const
    const { user } = await requireBrokerAdmin([...requiredRoles])
    await enforceBrokerRateLimit('admin_write', requestIdentifier(request, user.id))
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: connection, error: lookupError } = await admin
      .from('broker_connections')
      .select('id, user_id, status, validated_at, requested_strategy_code, requested_symbol, requested_timeframe')
      .eq('id', id)
      .neq('status', 'DELETED')
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!connection) throw new BrokerPlatformError('CONNECTION_NOT_FOUND', 'Conexión no encontrada.', 404)

    if (parsed.data.action === 'UPDATE_LABEL') {
      const { data: updated, error } = await admin.from('broker_connections')
        .update({ label: parsed.data.label })
        .eq('id', id)
        .neq('status', 'DELETED')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updated) throw new BrokerPlatformError('CONNECTION_STATE_CHANGED', 'La conexión cambió de estado. Actualizá la página.', 409)
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_LABEL_UPDATED', outcome: 'SUCCESS' })
      return NextResponse.json({ ok: true, label: parsed.data.label })
    }

    if (parsed.data.action === 'PREPARE_EDIT') {
      if (!['ACTIVE', 'SUSPENDED'].includes(connection.status)) {
        throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'La conexión debe estar activa o suspendida para editar sus límites.', 409)
      }
      await suspendBrokerConnectionForEdit(id, connection.user_id)
      if (connection.status === 'ACTIVE') {
        await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_SUSPENDED_FOR_EDIT', outcome: 'SUCCESS' })
      }
      await assertBrokerConnectionCanBeConfigured(id)
      const { data: preparedStatus, error } = await admin.rpc('prepare_broker_connection_edit', {
        target_connection_id: id,
        expected_user_id: connection.user_id,
      })
      if (error || preparedStatus !== 'PENDING_APPROVAL') {
        throw new BrokerPlatformError('CONNECTION_EDIT_FAILED', 'No se pudo preparar la conexión para editarla.', 409)
      }
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_EDIT_PREPARED', outcome: 'SUCCESS', metadata: { previousStatus: connection.status } })
      return NextResponse.json({ ok: true, status: 'PENDING_APPROVAL' })
    }

    if (parsed.data.action === 'APPROVE') {
      const strategy = brokerStrategy(connection.requested_strategy_code)
      if (!strategy || strategy.symbol !== connection.requested_symbol || strategy.timeframe !== connection.requested_timeframe) {
        throw new BrokerPlatformError('STRATEGY_CONFIGURATION_INVALID', 'La estrategia solicitada no coincide con el catálogo autorizado.', 409)
      }
      const configuredMaxLeverage = Number(process.env.BROKER_MAX_ALLOWED_LEVERAGE ?? 1)
      const globalMaxLeverage = Number.isFinite(configuredMaxLeverage) && configuredMaxLeverage >= 1
        ? configuredMaxLeverage
        : 1
      if (parsed.data.risk.maxLeverage > globalMaxLeverage) {
        throw new BrokerPlatformError('LEVERAGE_ABOVE_PLATFORM_LIMIT', `El máximo permitido por la plataforma es ${globalMaxLeverage}x.`, 422)
      }
      const { adapter } = await loadBrokerAdapter(id)
      const [rules, lastPrice] = await Promise.all([
        adapter.getInstrumentRules(strategy.symbol),
        adapter.getLastPrice(strategy.symbol),
      ])
      if (!rules.openEnabled || !rules.closeEnabled) {
        throw new BrokerPlatformError('INSTRUMENT_TRADING_DISABLED', 'BingX no permite abrir y cerrar este instrumento por API.', 422)
      }
      const minimumExecutableNotional = Math.max(rules.minimumNotional, rules.minimumQuantity * lastPrice)
      if (parsed.data.risk.fixedNotionalUsd + 1e-8 < minimumExecutableNotional) {
        throw new BrokerPlatformError('NOTIONAL_BELOW_INSTRUMENT_MINIMUM', `El tamaño debe ser al menos ${minimumExecutableNotional.toFixed(2)} USD con el precio actual de ${strategy.assetLabel}.`, 422)
      }
      const { error } = await admin.rpc('approve_broker_connection', {
        target_connection_id: id,
        actor_user_id: user.id,
        policy_allowed_symbols: [strategy.symbol],
        policy_sizing_mode: parsed.data.risk.sizingMode,
        policy_exposure_per_order_pct: parsed.data.risk.exposurePerOrderPct,
        policy_fixed_notional_usd: parsed.data.risk.fixedNotionalUsd,
        policy_max_notional_per_order_usd: parsed.data.risk.maxNotionalPerOrderUsd,
        policy_max_total_exposure_usd: parsed.data.risk.maxTotalExposureUsd,
        policy_max_leverage: parsed.data.risk.maxLeverage,
        policy_max_open_positions: parsed.data.risk.maxOpenPositions,
        policy_max_orders_per_minute: parsed.data.risk.maxOrdersPerMinute,
        policy_daily_loss_limit_usd: parsed.data.risk.dailyLossLimitUsd,
        policy_min_available_margin_usd: parsed.data.risk.minAvailableMarginUsd,
        binding_strategy_code: strategy.code,
        binding_symbol: strategy.symbol,
        binding_timeframe: strategy.timeframe,
      })
      if (error) throw new BrokerPlatformError('APPROVAL_FAILED', 'La conexión no cumple las condiciones de aprobación.', 409)
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_APPROVED', outcome: 'SUCCESS', metadata: { strategyCode: strategy.code, symbol: strategy.symbol, timeframe: strategy.timeframe, minimumExecutableNotional } })
      return NextResponse.json({ ok: true, status: 'ACTIVE' })
    }

    if (parsed.data.action === 'RESUME') {
      if (connection.status !== 'SUSPENDED') {
        throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'Sólo se puede reactivar una conexión suspendida.', 409)
      }
      const [{ data: membership }, { count: credentialsCount }] = await Promise.all([
        admin.from('broker_memberships').select('status').eq('user_id', connection.user_id).maybeSingle(),
        admin.from('broker_credential_envelopes').select('*', { count: 'exact', head: true }).eq('connection_id', id),
      ])
      if (membership?.status !== 'ACTIVE' || !credentialsCount) {
        throw new BrokerPlatformError('RESUME_REQUIREMENTS_NOT_MET', 'La membresía o las credenciales no permiten reactivar.', 409)
      }
      const [{ error }, { error: jobError }] = await Promise.all([
        admin.from('broker_connections').update({ status: 'PENDING_VALIDATION', validated_at: null, last_error_code: null }).eq('id', id),
        admin.from('broker_execution_jobs').insert({ connection_id: id, job_type: 'VALIDATE_CONNECTION' }),
      ])
      if (error || jobError) throw error || jobError
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_RESUME_REQUESTED', outcome: 'SUCCESS' })
      after(() => safeProcessBrokerJobsInApp({ batchSize: 2 }).then(() => undefined))
      return NextResponse.json({ ok: true, status: 'PENDING_VALIDATION' }, { status: 202 })
    }

    if (parsed.data.action === 'CONFIRM_MANUAL_RESOLUTION') {
      if (connection.status === 'REVOKED') {
        return NextResponse.json({ ok: true, status: 'REVOKED' })
      }
      if (connection.status !== 'MANUAL_INTERVENTION_REQUIRED') {
        throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'La conexión no requiere resolución manual.', 409)
      }
      const { error } = await admin.from('broker_connections').update({ status: 'REVOKED' }).eq('id', id)
      if (error) throw error
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'MANUAL_RESOLUTION_CONFIRMED', outcome: 'SUCCESS' })
      return NextResponse.json({ ok: true, status: 'REVOKED' })
    }

    if (parsed.data.action === 'REVOKE') {
      const result = await revokeBrokerConnection(connection)
      await writeBrokerAudit({
        request,
        userId: connection.user_id,
        actorUserId: user.id,
        connectionId: id,
        eventType: 'CONNECTION_REVOKED_BY_ADMIN',
        outcome: 'SUCCESS',
        metadata: {
          finalStatus: result.status,
          positionCheck: result.positionCheck,
          openPositionCount: result.openPositionCount,
          checkErrorCode: result.checkErrorCode,
        },
      })
      return NextResponse.json({ ok: true, status: result.status })
    }

    if (parsed.data.action === 'REJECT' && connection.status !== 'PENDING_APPROVAL') {
      throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'Sólo se puede rechazar una conexión pendiente de aprobación.', 409)
    }
    if (parsed.data.action === 'REJECT') {
      const finalStatus = await rejectBrokerConnection(id, connection.user_id)
      if (finalStatus !== 'REJECTED') {
        throw new BrokerPlatformError('CONNECTION_STATE_CHANGED', 'La conexión cambió de estado. Actualizá la página.', 409)
      }
      await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_REJECTED', outcome: 'SUCCESS' })
      return NextResponse.json({ ok: true, status: 'REJECTED' })
    }
    if (parsed.data.action === 'SUSPEND' && connection.status !== 'ACTIVE') {
      throw new BrokerPlatformError('INVALID_CONNECTION_STATE', 'Sólo se puede suspender una conexión activa.', 409)
    }

    const { data: suspended, error } = await admin.from('broker_connections').update({
      status: 'SUSPENDED',
      suspended_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'ACTIVE').select('id').maybeSingle()
    if (error) throw error
    if (!suspended) throw new BrokerPlatformError('CONNECTION_STATE_CHANGED', 'La conexión cambió de estado. Actualizá la página.', 409)
    const { error: riskError } = await admin.from('broker_risk_policies').update({ enabled: false }).eq('connection_id', id)
    if (riskError) throw new BrokerPlatformError('CONNECTION_SUSPEND_INCOMPLETE', 'La conexión fue suspendida, pero no se pudo actualizar el riesgo.', 503, true)
    await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_SUSPENDED', outcome: 'SUCCESS' })
    return NextResponse.json({ ok: true, status: 'SUSPENDED' })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user } = await requireBrokerAdmin(['security_admin'])
    await enforceBrokerRateLimit('admin_write', requestIdentifier(request, user.id))
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: connection } = await admin.from('broker_connections').select('user_id, status').eq('id', id).maybeSingle()
    if (!connection) throw new BrokerPlatformError('CONNECTION_NOT_FOUND', 'Conexión no encontrada.', 404)
    if (connection.status === 'DELETED') return NextResponse.json({ ok: true })
    if (!canDeleteConnection(connection.status)) {
      throw new BrokerPlatformError('CONNECTION_DELETE_BLOCKED', 'La conexión debe estar revocada o rechazada.', 409)
    }
    const finalStatus = await softDeleteBrokerConnection(id, connection.user_id)
    if (finalStatus !== 'DELETED') {
      throw new BrokerPlatformError('CONNECTION_DELETE_BLOCKED', 'La conexión cambió de estado. Actualizá la página.', 409)
    }
    await writeBrokerAudit({ request, userId: connection.user_id, actorUserId: user.id, connectionId: id, eventType: 'CONNECTION_DELETED_BY_ADMIN', outcome: 'SUCCESS' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const response = publicError(error)
    return NextResponse.json(response.body, { status: response.status })
  }
}
