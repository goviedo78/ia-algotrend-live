import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })
  const env = getSupabaseEnv()

  if (!env) return response

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch (error) {
    console.error('[supabase/middleware] Session refresh failed', error)
  }

  return response
}

export function copySupabaseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  return to
}
