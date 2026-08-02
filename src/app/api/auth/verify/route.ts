import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  enforceOtpVerificationLimits,
  normalizeOtpEmail,
  OtpRateLimitError,
} from '@/lib/auth/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const verifySchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  _hp: z.string().optional(),
})

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = verifySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
    }

    if (parsed.data._hp) {
      return NextResponse.json({ ok: true })
    }

    const email = normalizeOtpEmail(parsed.data.email)
    await enforceOtpVerificationLimits({ ip: getIp(req), email })

    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.code,
      type: 'email',
    })

    if (error || !data.user) {
      if (error) console.error('[auth/verify] Supabase verify error', error)
      return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
      },
    })
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      const unavailable = error.code === 'RATE_LIMIT_UNAVAILABLE'
      return NextResponse.json(
        {
          error: unavailable ? 'verification_unavailable' : 'invalid_code',
          message: unavailable
            ? 'No se pudo verificar el código. Intentá de nuevo en unos minutos.'
            : 'Demasiados intentos. Esperá un minuto.',
        },
        {
          status: unavailable ? 503 : 429,
          headers: unavailable ? undefined : { 'Retry-After': String(error.retryAfterSeconds ?? 60) },
        },
      )
    }
    console.error('[auth/verify] Unexpected error', error)
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
}
