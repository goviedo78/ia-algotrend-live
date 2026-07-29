import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type LegacyBingxAction = 'OPEN' | 'CLOSE'
export type LegacyBingxExecutionStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'FILLED'
  | 'SKIPPED'
  | 'FAILED'
  | 'UNKNOWN'

export type LegacyBingxExecution = {
  id: string
  trade_id: number
  action: LegacyBingxAction
  direction: 'LONG' | 'SHORT'
  symbol: 'BTC-USDT'
  source: 'cron' | 'webhook' | 'signal'
  status: LegacyBingxExecutionStatus
  client_order_id: string
  broker_order_id: string | null
  requested_quantity: number
  executed_quantity: number
  average_price: number | null
  attempt_count: number
  last_error_code: string | null
  last_error_message: string | null
  raw_status: Record<string, unknown>
  submitted_at: string | null
  filled_at: string | null
  last_attempt_at: string | null
  created_at: string
  updated_at: string
}

type BeginExecutionInput = {
  tradeId: number
  action: LegacyBingxAction
  direction: 'LONG' | 'SHORT'
  source: 'cron' | 'webhook' | 'signal'
  clientOrderId: string
  requestedQuantity: number
}

export async function getLegacyBingxExecution(
  tradeId: number,
  action: LegacyBingxAction,
): Promise<LegacyBingxExecution | null> {
  const { data, error } = await createAdminClient()
    .from('legacy_bingx_executions')
    .select('*')
    .eq('trade_id', tradeId)
    .eq('action', action)
    .maybeSingle()
  if (error) throw error
  return data as LegacyBingxExecution | null
}

export async function beginLegacyBingxExecution(
  input: BeginExecutionInput,
): Promise<LegacyBingxExecution> {
  const now = new Date().toISOString()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('legacy_bingx_executions')
    .insert({
      trade_id: input.tradeId,
      action: input.action,
      direction: input.direction,
      source: input.source,
      client_order_id: input.clientOrderId,
      requested_quantity: input.requestedQuantity,
      status: 'PENDING',
      attempt_count: 1,
      last_attempt_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (!error) return data as LegacyBingxExecution
  if (error.code !== '23505') throw error

  const existing = await getLegacyBingxExecution(input.tradeId, input.action)
  if (!existing) throw new Error('Legacy BingX execution conflict without an existing row')
  if (existing.status === 'FILLED' || existing.status === 'SKIPPED') return existing

  const { data: retried, error: retryError } = await admin
    .from('legacy_bingx_executions')
    .update({
      source: input.source,
      requested_quantity: input.requestedQuantity,
      attempt_count: existing.attempt_count + 1,
      last_attempt_at: now,
      updated_at: now,
    })
    .eq('id', existing.id)
    .neq('status', 'FILLED')
    .select()
    .single()
  if (retryError) throw retryError
  return retried as LegacyBingxExecution
}

export async function completeLegacyBingxExecution(input: {
  executionId: string
  status: 'SUBMITTED' | 'FILLED' | 'SKIPPED'
  brokerOrderId?: string | null
  requestedQuantity?: number
  executedQuantity?: number
  averagePrice?: number | null
  rawStatus?: Record<string, unknown>
  errorCode?: string | null
  errorMessage?: string | null
}) {
  const now = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from('legacy_bingx_executions')
    .update({
      status: input.status,
      broker_order_id: input.brokerOrderId,
      requested_quantity: input.requestedQuantity,
      executed_quantity: input.executedQuantity,
      average_price: input.averagePrice,
      raw_status: input.rawStatus ?? {},
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage ?? null,
      submitted_at: input.brokerOrderId ? now : undefined,
      filled_at: input.status === 'FILLED' ? now : undefined,
      updated_at: now,
    })
    .eq('id', input.executionId)
    .select()
    .single()
  if (error) throw error
  return data as LegacyBingxExecution
}

export async function failLegacyBingxExecution(input: {
  executionId: string
  status: 'FAILED' | 'UNKNOWN'
  errorCode: string
  errorMessage: string
}) {
  const { data, error } = await createAdminClient()
    .from('legacy_bingx_executions')
    .update({
      status: input.status,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.executionId)
    .neq('status', 'FILLED')
    .select()
    .maybeSingle()
  if (error) throw error
  return data as LegacyBingxExecution | null
}
