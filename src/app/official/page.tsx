import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import OfficialHome from '@/components/official/OfficialHome'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'GONOVI · AlgoTrend Official',
  description: 'La casa oficial de GONOVI: indicadores AlgoTrend, demos, academia interactiva, partners y comunidad.',
  alternates: {
    canonical: 'https://gonovi.app/official',
  },
  openGraph: {
    title: 'GONOVI · AlgoTrend Official',
    description: 'Indicadores, academia interactiva y ecosistema de trading visual para la comunidad GONOVI.',
    url: 'https://gonovi.app/official',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GONOVI · AlgoTrend Official',
    description: 'Indicadores AlgoTrend con Pine Script completo, Trading Lab, instalacion en TradingView y comunidad GONOVI.',
    images: ['/og-card.png'],
  },
}

export const dynamic = 'force-dynamic'

export default function OfficialPage() {
  if (process.env.OFFICIAL_ENABLED !== 'true') notFound()
  return <OfficialHome />
}
