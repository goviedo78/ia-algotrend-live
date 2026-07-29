import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimiter } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const otpSchema = z.object({
  email: z.string().email().max(254),
  _hp: z.string().optional(),
})

type SupabaseAuthError = {
  code?: unknown
  status?: unknown
}

const RATE_LIMIT_MESSAGE = 'Esperá un minuto antes de pedir otro código.'
const DELIVERY_ERROR_MESSAGE = 'No se pudo enviar el código. Intentá de nuevo en unos minutos.'

function getAuthErrorDetails(error: unknown): { code?: string; status?: number } {
  if (!error || typeof error !== 'object') return {}

  const candidate = error as SupabaseAuthError
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
  }
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = otpSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ ok: true })
    }

    if (parsed.data._hp) {
      return NextResponse.json({ ok: true })
    }

    const { success, resetIn } = rateLimiter.check(getIp(req), 'auth')
    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: true },
    })

    if (error) {
      const details = getAuthErrorDetails(error)
      console.error('[auth/otp] Supabase OTP error', details)

      if (details.status === 429 || details.code === 'over_email_send_rate_limit') {
        return NextResponse.json(
          { ok: false, error: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE },
          { status: 429, headers: { 'Retry-After': '60' } }
        )
      }

      return NextResponse.json(
        { ok: false, error: 'EMAIL_DELIVERY_FAILED', message: DELIVERY_ERROR_MESSAGE },
        { status: 503 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/otp] Unexpected error', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json(
      { ok: false, error: 'EMAIL_DELIVERY_FAILED', message: DELIVERY_ERROR_MESSAGE },
      { status: 503 }
    )
  }
}
