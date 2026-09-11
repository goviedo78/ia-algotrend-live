import { NextResponse } from 'next/server'
import { getCachedStrategySnapshot } from '@/lib/public-cache'

// Polled by /official/estrategias. The realtime channel cannot deliver
// trade rows to anonymous visitors (RLS hides them), so the client asks
// for the shared snapshot instead. Same cache entry as the page render.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = await getCachedStrategySnapshot()
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=5, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[estrategias]', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
