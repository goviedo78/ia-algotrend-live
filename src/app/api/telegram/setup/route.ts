import { NextResponse } from 'next/server'

// GET /api/telegram/setup — returns setup instructions for the bot
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token) {
    return NextResponse.json({
      configured: false,
      message: 'Falta TELEGRAM_BOT_TOKEN en .env.local',
    })
  }

  // Verify bot is reachable
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const data = await res.json() as { ok: boolean; result?: { username: string; first_name: string } }

  return NextResponse.json({
    configured: !!chatId,
    botOk: data.ok,
    botName: data.result?.first_name,
    botUsername: data.result?.username,
    chatId: chatId ?? null,
  })
}
