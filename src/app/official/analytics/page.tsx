import type { Metadata } from 'next'
import {
  getCardClickStats,
  getDeviceStats,
  getNotificationStats,
  getPageviewStats,
  getSponsorStats,
  getTradePerformanceStats,
} from '@/lib/analytics'
import { AnalyticsDashboard } from '@/components/official/analytics/AnalyticsDashboard'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Analytics Interno | GONOVI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ pin?: string }>
}

const VALID_PIN = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD

export default async function AnalyticsPage({ searchParams }: Props) {
  const { pin } = await searchParams

  if (!VALID_PIN || pin !== VALID_PIN) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0d1122',
        color: 'rgba(229,212,182,0.62)',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.76rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
          <p>Panel privado — se requiere PIN</p>
          <p style={{ color: 'rgba(229,212,182,0.32)', fontSize: '0.64rem' }}>
            Agregar <code>?pin=TU_PIN</code> a la URL
          </p>
          <Link href="/official" style={{ color: '#ff8a60', textDecoration: 'none' }}>← Volver al inicio</Link>
        </div>
      </main>
    )
  }

  const [stats, cardClicks] = await Promise.all([
    Promise.all([
      getPageviewStats(),
      getNotificationStats(),
      getDeviceStats(),
      getSponsorStats(),
      getTradePerformanceStats(),
    ])
      .then(([pageviews, notifications, devices, sponsor, trades]) => ({
        devices, notifications, pageviews, sponsor, trades,
      }))
      .catch(() => null),
    getCardClickStats().catch(() => []),
  ])

  return <AnalyticsDashboard stats={stats} cardClicks={cardClicks} />
}
