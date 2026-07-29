import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { loadBrokerAdapter } from './adapter-loader'
import type { ConnectionStatus } from './domain'
import { BrokerPlatformError } from './errors'

type RevocableConnection = {
  id: string
  user_id: string
  status: ConnectionStatus
}

export type RevocationResult = {
  status: 'REVOKED' | 'MANUAL_INTERVENTION_REQUIRED'
  positionCheck: 'NOT_REQUIRED' | 'BROKER_CONFIRMED' | 'BROKER_UNAVAILABLE'
  openPositionCount: number | null
  checkErrorCode: string | null
}

export async function assertBrokerConnectionCanBeConfigured(connectionId: string) {
  const admin = createAdminClient()
  const { count, error: jobsError } = await admin
    .from('broker_execution_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .in('status', ['QUEUED', 'RETRY', 'PROCESSING'])
    .in('job_type', ['EXECUTE_ORDER', 'RECONCILE_ORDER'])
  if (jobsError) throw jobsError
  if ((count ?? 0) > 0) {
    throw new BrokerPlatformError('CONNECTION_JOBS_PENDING', 'Esperá a que terminen las órdenes pendientes antes de editar esta conexión.', 409)
  }

  try {
    const { adapter } = await loadBrokerAdapter(connectionId)
    const positions = await adapter.getPositions()
    if (positions.some((position) => position.quantity > 0)) {
      throw new BrokerPlatformError('CONNECTION_HAS_OPEN_POSITIONS', 'Cerrá las posiciones abiertas en el broker antes de editar esta conexión.', 409)
    }
  } catch (error) {
    if (error instanceof BrokerPlatformError && error.code === 'CONNECTION_HAS_OPEN_POSITIONS') throw error
    throw new BrokerPlatformError('CONNECTION_POSITION_CHECK_FAILED', 'No se pudo confirmar que la cuenta esté sin posiciones. La edición quedó bloqueada.', 503, true)
  }
}

export async function suspendBrokerConnectionForEdit(connectionId: string, userId: string) {
  const { data, error } = await createAdminClient().rpc('suspend_broker_connection_for_edit', {
    target_connection_id: connectionId,
    expected_user_id: userId,
  })
  if (error || data !== 'SUSPENDED') {
    throw new BrokerPlatformError('CONNECTION_EDIT_SUSPEND_FAILED', 'No se pudo pausar la conexión para editarla. Esperá a que terminen las órdenes pendientes.', 409)
  }
}

function lifecycleErrorCode(error: unknown) {
  return error instanceof BrokerPlatformError ? error.code : 'POSITION_CHECK_FAILED'
}

export async function revokeBrokerConnection(connection: RevocableConnection): Promise<RevocationResult> {
  let requestedStatus: RevocationResult['status'] = 'REVOKED'
  let positionCheck: RevocationResult['positionCheck'] = 'NOT_REQUIRED'
  let openPositionCount: number | null = null
  let checkErrorCode: string | null = null

  if (['ACTIVE', 'SUSPENDED'].includes(connection.status)) {
    try {
      const { adapter } = await loadBrokerAdapter(connection.id)
      const positions = await adapter.getPositions()
      openPositionCount = positions.filter((position) => position.quantity > 0).length
      requestedStatus = openPositionCount > 0 ? 'MANUAL_INTERVENTION_REQUIRED' : 'REVOKED'
      positionCheck = 'BROKER_CONFIRMED'
    } catch (error) {
      requestedStatus = 'MANUAL_INTERVENTION_REQUIRED'
      positionCheck = 'BROKER_UNAVAILABLE'
      checkErrorCode = lifecycleErrorCode(error)
    }
  } else if (connection.status === 'MANUAL_INTERVENTION_REQUIRED') {
    requestedStatus = 'MANUAL_INTERVENTION_REQUIRED'
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('finalize_broker_connection_revocation', {
    target_connection_id: connection.id,
    expected_user_id: connection.user_id,
    requested_status: requestedStatus,
  })
  if (error) {
    throw new BrokerPlatformError('CONNECTION_REVOCATION_FAILED', 'No se pudo revocar la conexión de forma segura.', 503, true)
  }
  if (!data || !['REVOKED', 'MANUAL_INTERVENTION_REQUIRED'].includes(String(data))) {
    throw new BrokerPlatformError('CONNECTION_STATE_CHANGED', 'La conexión cambió de estado. Actualizá la página.', 409)
  }

  return {
    status: String(data) as RevocationResult['status'],
    positionCheck,
    openPositionCount,
    checkErrorCode,
  }
}

export async function softDeleteBrokerConnection(connectionId: string, userId: string) {
  const { data, error } = await createAdminClient().rpc('soft_delete_broker_connection', {
    target_connection_id: connectionId,
    expected_user_id: userId,
  })
  if (error) {
    throw new BrokerPlatformError('CONNECTION_DELETE_FAILED', 'No se pudo eliminar la conexión de forma segura.', 503, true)
  }
  return data ? String(data) as ConnectionStatus : null
}

export async function rejectBrokerConnection(connectionId: string, userId: string) {
  const { data, error } = await createAdminClient().rpc('reject_broker_connection', {
    target_connection_id: connectionId,
    expected_user_id: userId,
  })
  if (error) {
    throw new BrokerPlatformError('CONNECTION_REJECTION_FAILED', 'No se pudo rechazar la conexión de forma segura.', 503, true)
  }
  return data ? String(data) as ConnectionStatus : null
}
