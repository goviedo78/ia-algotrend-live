import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return { url, anonKey }
}

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies; proxy refreshSession handles refreshes.
        }
      },
    },
  })
}

export const createServerClient = createClient

export async function getUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) return null
  return data.user
}
