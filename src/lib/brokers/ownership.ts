import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { BrokerPlatformError } from './errors'

export async function requireOwnedConnection(connectionId: string, userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('broker_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .neq('status', 'DELETED')
    .maybeSingle()
  if (error) throw new BrokerPlatformError('CONNECTION_LOOKUP_FAILED', 'No se pudo verificar la conexión.', 503, true)
  if (!data) throw new BrokerPlatformError('CONNECTION_NOT_FOUND', 'Conexión no encontrada.', 404)
  return data
}
