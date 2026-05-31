import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Endpoint de debug para descubrir chat_ids del bot al inicializar Telegram.
// Solo Gonzalo lo usa manualmente desde consola con `curl -H "Authorization: Bearer $CRON_SECRET"`.
//
// Cambios de seguridad (auditoría 30-may):
// - GET ya NO acepta `?token=` en query (terminaba en logs de Vercel/Cloudflare).
//   Usa SOLO `process.env.TELEGRAM_BOT_TOKEN`.
// - GET ahora requiere `Authorization: Bearer ${CRON_SECRET}` porque la respuesta
//   incluye mensajes del bot (datos sensibles).
// - Se eliminó el handler POST: era un echo zombie sin uso.

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim()
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization')?.trim()
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN no configurado' }, { status: 503 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = (await res.json()) as {
      ok: boolean
      result: Array<{ message?: { chat: { id: number }; text: string } }>
    }

    const updates = (data.result ?? [])
      .filter((u) => u.message)
      .map((u) => ({ chatId: u.message!.chat.id, text: u.message!.text }))

    return NextResponse.json({ ok: true, updates })
  } catch (err) {
    console.error('[telegram/notify]', err)
    return NextResponse.json({ error: 'Telegram API failed' }, { status: 502 })
  }
}
