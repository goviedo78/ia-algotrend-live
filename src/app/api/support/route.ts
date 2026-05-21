import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_123')
const TO_EMAIL = process.env.ALERT_EMAIL || 'gonovi.tv@gmail.com'

// Basic sanitization rule: remove HTML tags and potential script injections
function sanitizeInput(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>?/gm, '').trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, subject, message, _gotcha } = body

    if (_gotcha) {
      // Honeypot tripped
      return NextResponse.json({ ok: true }) // Lie to the bot
    }

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Input Validation & Sanitization (OWASP A03: Injection prevention)
    const cleanName = sanitizeInput(name).substring(0, 100);
    const cleanEmail = sanitizeInput(email).substring(0, 150);
    const cleanSubject = sanitizeInput(subject).substring(0, 200);
    const cleanMessage = sanitizeInput(message).substring(0, 5000); // Max 5000 chars

    // Email format basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('[Support API] No RESEND_API_KEY found, simulating success.')
      return NextResponse.json({ ok: true })
    }

    await resend.emails.send({
      from: 'GONOVI Soporte <soporte@algotrend.app>', // Must be a verified domain in Resend
      to: TO_EMAIL,
      replyTo: cleanEmail,
      subject: `[Soporte GONOVI] ${cleanSubject}`,
      text: `Nombre: ${cleanName}\nEmail: ${cleanEmail}\n\nMensaje:\n${cleanMessage}`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Support API error]', error)
    return NextResponse.json({ error: 'Error enviando el mensaje' }, { status: 500 })
  }
}
