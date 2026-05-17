import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

export const dynamic = 'force-dynamic'

// Send push to all AlgoTrend subscribers
export async function POST(req: NextRequest) {
  try {
    const { title, body, tag } = await req.json() as { title: string; body: string; tag?: string }
    const result = await sendPushNotification({ title, body, tag })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
