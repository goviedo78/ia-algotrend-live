import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Dashboard from '@/components/Dashboard'
import OfficialHome from '@/components/official/OfficialHome'

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
      metadataBase: new URL('https://gonovi.app'),
      title: 'GONOVI · Inicio',
      description: 'Hub personal de GONOVI: indicadores, demos, educación interactiva, resultados en vivo y comunidad de trading.',
      alternates: {
        canonical: 'https://gonovi.app',
      },
      openGraph: {
        title: 'GONOVI · Inicio',
        description: 'Indicadores, educación interactiva y ecosistema de trading visual para la comunidad GONOVI.',
        url: 'https://gonovi.app',
        siteName: 'GONOVI',
        images: [{ url: '/og-card.png', width: 1200, height: 630 }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'GONOVI · Inicio',
        description: 'Indicadores con Pine Script, Trading Lab, instalación en TradingView y comunidad GONOVI.',
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
    return <OfficialHome />
  }

  return <Dashboard />
}
