import { NextResponse } from 'next/server'
import { getCachedTradeSnapshot } from '@/lib/public-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = await getCachedTradeSnapshot()
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=5, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[trades]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
