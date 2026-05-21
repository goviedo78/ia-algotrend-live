import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimiter } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const logoutSchema = z.object({
  _hp: z.string().optional(),
}).optional()

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}))
    const parsed = logoutSchema.safeParse(json)

    if (parsed.success && parsed.data?._hp) {
      return NextResponse.json({ ok: true })
    }

    const { success, resetIn } = rateLimiter.check(getIp(req), 'auth')
    if (!success) {
      return NextResponse.json(
        { ok: true },
        { status: 200, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[auth/logout] Supabase signOut error', error)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/logout] Unexpected error', error)
    return NextResponse.json({ ok: true })
  }
}
