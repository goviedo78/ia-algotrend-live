import { createClient } from '@supabase/supabase-js'
import { DATA_TIMEOUT_MS, fetchWithTimeout } from '@/lib/supabase/fetch-timeout'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(url, serviceRoleKey, {
    global: { fetch: fetchWithTimeout(DATA_TIMEOUT_MS) },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
