import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Dashboard from '@/components/Dashboard'
import { ComingSoonPage } from '@/components/official/ComingSoonPage'

export const dynamic = 'force-dynamic'

const OFFICIAL_ROOT_HOSTS = new Set(['gonovi.app', 'www.gonovi.app'])

async function getRequestHost() {
  const headerStore = await headers()
  return headerStore.get('host')?.split(':')[0]?.toLowerCase() || ''
}

function isOfficialRootHost(host: string) {
  return OFFICIAL_ROOT_HOSTS.has(host)
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getRequestHost()

  if (isOfficialRootHost(host)) {
    return {
      title: 'GONOVI · Próximamente',
      description: 'El hub personal de GONOVI está siendo preparado. Los productos del ecosistema siguen activos.',
      openGraph: {
        title: 'GONOVI · Próximamente',
        description: 'Nueva experiencia en camino para el hub personal de GONOVI.',
        url: 'https://gonovi.app',
        siteName: 'GONOVI',
        images: [{ url: '/og-card.png', width: 1200, height: 630 }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'GONOVI · Próximamente',
        description: 'Nueva experiencia en camino para el hub personal de GONOVI.',
        images: ['/og-card.png'],
      },
    }
  }

  return {
    title: 'IA AlgoTrend · Live Trading Desk',
    description: 'Mesa de monitoreo en vivo para la estrategia Algotrend en BTC/USD.',
  }
}

export default async function Home() {
  const host = await getRequestHost()

  if (isOfficialRootHost(host)) {
    return <ComingSoonPage />
  }

  return <Dashboard />
}
