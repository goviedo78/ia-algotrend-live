import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createBrokerAdapter } from './adapters/registry'
import { decryptCredentials, type CredentialEnvelope } from './crypto'
import type { BrokerCode, BrokerEnvironment } from './domain'
import { BrokerPlatformError } from './errors'

function envelopeFromRow(row: Record<string, unknown>): CredentialEnvelope {
  return {
    ciphertext: String(row.ciphertext),
    encryptedDataKey: String(row.encrypted_data_key),
    iv: String(row.iv),
    authTag: String(row.auth_tag),
    aad: row.aad as Record<string, string | number>,
    kmsKeyId: String(row.kms_key_id),
    algorithm: row.algorithm as 'AES-256-GCM',
    version: Number(row.version),
  }
}

// The AAD is bound to the connection at encryption time (route + rotate both use
// { connectionId, userId, broker, environment, ... }). GCM only proves the AAD
// wasn't altered relative to its own ciphertext, so we still assert it matches the
// connection we are about to operate on. This guarantees we never decrypt and trade
// with credentials that belong to a different connection or account.
function assertEnvelopeContext(envelope: CredentialEnvelope, connection: Record<string, unknown>) {
  const aad = envelope.aad ?? {}
  const matches =
    String(aad.connectionId) === String(connection.id) &&
    String(aad.userId) === String(connection.user_id) &&
    String(aad.broker) === String(connection.broker) &&
    String(aad.environment) === String(connection.environment)
  if (!matches) {
    throw new BrokerPlatformError('CREDENTIAL_CONTEXT_MISMATCH', 'Las credenciales no corresponden a esta conexión.', 500)
  }
}

export async function loadBrokerAdapter(connectionId: string) {
  const admin = createAdminClient()
  const [{ data: connection, error: connectionError }, { data: envelope, error: envelopeError }] = await Promise.all([
    admin.from('broker_connections').select('*').eq('id', connectionId).maybeSingle(),
    admin.from('broker_credential_envelopes').select('*').eq('connection_id', connectionId).maybeSingle(),
  ])
  if (connectionError || !connection) throw new BrokerPlatformError('CONNECTION_NOT_FOUND', 'Conexión no encontrada.', 404)
  if (envelopeError || !envelope) throw new BrokerPlatformError('CREDENTIALS_MISSING', 'Credenciales no disponibles.', 409)
  const envelopeData = envelopeFromRow(envelope)
  assertEnvelopeContext(envelopeData, connection)
  const credentials = await decryptCredentials(envelopeData)
  return {
    connection,
    adapter: createBrokerAdapter(connection.broker as BrokerCode, {
      credentials,
      environment: connection.environment as BrokerEnvironment,
    }),
  }
}
