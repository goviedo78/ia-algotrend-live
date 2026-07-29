import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeBrokerAudit } from './audit'
import type { BrokerSignalInput } from './schemas'
import { BrokerPlatformError } from './errors'

function canonicalPayload(input: BrokerSignalInput) {
  return JSON.stringify({
    externalSignalId: input.externalSignalId,
    strategyCode: input.strategyCode,
    symbol: input.symbol,
    timeframe: input.timeframe,
    action: input.action,
    direction: input.direction,
    signalTime: input.signalTime,
    price: input.price ?? null,
  })
}

export async function dispatchBrokerSignal(
  input: BrokerSignalInput,
  options: { nonce?: string; request?: NextRequest } = {},
) {
  const admin = createAdminClient()
  const payloadHash = createHash('sha256').update(canonicalPayload(input)).digest('hex')
  const nonce = options.nonce ?? `internal-${payloadHash.slice(0, 48)}`
  let signalId = randomUUID()
  let duplicate = false

  const { error: signalError } = await admin.from('broker_signals').insert({
    id: signalId,
    external_signal_id: input.externalSignalId,
    strategy_code: input.strategyCode,
    symbol: input.symbol,
    timeframe: input.timeframe,
    action: input.action,
    direction: input.direction,
    signal_time: input.signalTime,
    reference_price: input.price ?? null,
    nonce,
    payload_hash: payloadHash,
  })
  if (signalError?.code === '23505') {
    const { data: existing } = await admin
      .from('broker_signals')
      .select('id, payload_hash')
      .eq('strategy_code', input.strategyCode)
      .eq('external_signal_id', input.externalSignalId)
      .maybeSingle()
    if (!existing || existing.payload_hash !== payloadHash) {
      throw new BrokerPlatformError('SIGNAL_ID_CONFLICT', 'El identificador de señal ya existe con otro contenido.', 409)
    }
    signalId = existing.id
    duplicate = true
  }
  if (signalError && signalError.code !== '23505') throw signalError

  const fanoutStartedAt = Date.now()
  const { data: acceptedData, error: fanoutError } = await admin.rpc('fanout_broker_signal', {
    target_signal_id: signalId,
  })
  if (fanoutError || typeof acceptedData !== 'number') {
    throw new BrokerPlatformError('SIGNAL_FANOUT_FAILED', 'No se pudo distribuir la señal a las cuentas.', 503, true)
  }
  const accepted = acceptedData
  const fanoutLatencyMs = Date.now() - fanoutStartedAt

  await writeBrokerAudit({
    request: options.request,
    eventType: 'SIGNAL_ACCEPTED',
    outcome: 'SUCCESS',
    metadata: { strategyCode: input.strategyCode, accepted, fanoutLatencyMs, source: options.request ? 'api' : 'app_cron' },
  })
  return { accepted, duplicate, signalId, fanoutLatencyMs }
}
