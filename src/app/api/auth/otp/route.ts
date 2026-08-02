import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deliverEmailOtp,
  OtpDeliveryError,
} from '@/lib/auth/otp-delivery'
import {
  enforceOtpRequestLimits,
  normalizeOtpEmail,
  OtpRateLimitError,
} from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

const otpSchema = z.object({
  email: z.string().email().max(254),
  _hp: z.string().optional(),
})

const DELIVERY_ERROR_MESSAGE = 'No se pudo enviar el código. Intentá de nuevo en unos minutos.'
const RATE_LIMIT_MESSAGE = 'Esperá un minuto antes de pedir otro código.'

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

    const email = normalizeOtpEmail(parsed.data.email)
    await enforceOtpRequestLimits({ ip: getIp(req), email })
    await deliverEmailOtp(email)

    return NextResponse.json({ ok: true, delivery: 'sent' })
  } catch (error) {
    if (error instanceof OtpRateLimitError && error.code === 'RATE_LIMITED') {
      return NextResponse.json(
        { ok: false, error: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds ?? 60) },
        },
      )
    }

    const details = error instanceof OtpDeliveryError
      ? { code: error.code, status: error.providerStatus }
      : error instanceof OtpRateLimitError
        ? { code: error.code }
        : { code: 'UNEXPECTED_ERROR' }
    console.error('[auth/otp] Direct delivery failed', details)

    return NextResponse.json(
      { ok: false, error: 'EMAIL_DELIVERY_FAILED', message: DELIVERY_ERROR_MESSAGE },
      { status: 503 }
    )
  }
}
