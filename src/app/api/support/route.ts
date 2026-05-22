import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_123')
const TO_EMAIL = process.env.ALERT_EMAIL || 'gonovi.tv@gmail.com'

const SupportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(150),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  _gotcha: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null)
    if (!raw) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    // Honeypot: si está lleno, fingimos éxito y no procesamos nada
    if (typeof raw._gotcha === 'string' && raw._gotcha.length > 0) {
      return NextResponse.json({ ok: true })
    }

    const parsed = SupportSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Campos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, subject, message } = parsed.data

    // 1) Leer sesión (puede ser null para anónimos)
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 2) Insertar en support_tickets — logueado vía RLS, anónimo vía service role
    try {
      if (user) {
        const { error: insertErr } = await supabase
          .from('gonovi_support_tickets')
          .insert({
            user_id: user.id,
            email,
            subject,
            message,
            status: 'open',
          })
        if (insertErr) {
          console.error('[Support API] insert (authed) failed:', insertErr.message)
        }
      } else {
        const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (serviceUrl && serviceKey) {
          const admin = createSupabaseAdmin(serviceUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
          const { error: insertErr } = await admin
            .from('gonovi_support_tickets')
            .insert({
              user_id: null,
              email,
              subject,
              message,
              status: 'open',
            })
          if (insertErr) {
            console.error('[Support API] insert (anon) failed:', insertErr.message)
          }
        } else {
          console.warn('[Support API] No service role configured, skipping anon insert')
        }
      }
    } catch (dbErr) {
      // Nunca rompemos la UX por fallos de DB; el email sigue
      console.error('[Support API] DB error:', dbErr)
    }

    // 3) Enviar email (igual que antes — comportamiento existente preservado)
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Support API] No RESEND_API_KEY found, simulating success.')
      return NextResponse.json({ ok: true })
    }

    await resend.emails.send({
      from: 'GONOVI Soporte <soporte@algotrend.app>',
      to: TO_EMAIL,
      replyTo: email,
      subject: `[Soporte GONOVI] ${subject}`,
      text: `Nombre: ${name}\nEmail: ${email}${user ? '\nUser ID: ' + user.id : '\nAnónimo'}\n\nMensaje:\n${message}`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Support API error]', error)
    return NextResponse.json({ error: 'Error enviando el mensaje' }, { status: 500 })
  }
}