import { NextRequest, NextResponse } from 'next/server'
import { getPageviewStats, getNotificationStats, getDeviceStats, getSponsorStats, getTradePerformanceStats } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth check via cookie
  const token = req.cookies.get('algotrend_dash')?.value
  if (!token || token !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [pageviews, notifications, devices, sponsor, trades] = await Promise.all([
      getPageviewStats(),
      getNotificationStats(),
      getDeviceStats(),
      getSponsorStats(),
      getTradePerformanceStats(),
    ])

    return NextResponse.json({
      ok: true,
      pageviews,
      notifications,
      devices,
      sponsor,
      trades,
    })
  } catch (err) {
    console.error('[analytics/stats]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
