import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Simple webhook: browser sends chat_id after user messages the bot
export async function POST(req: NextRequest) {
  const { chatId } = await req.json() as { chatId: string }
  // In production store this in DB; for now just echo back
  return NextResponse.json({ ok: true, chatId })
}

// GET /api/telegram/notify?token=BOT_TOKEN — returns updates to find chat_id
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 400 })

  const res  = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`)
  const data = await res.json() as { ok: boolean; result: Array<{ message?: { chat: { id: number }; text: string } }> }

  const updates = (data.result ?? [])
    .filter(u => u.message)
    .map(u => ({ chatId: u.message!.chat.id, text: u.message!.text }))

  return NextResponse.json({ ok: true, updates })
}
