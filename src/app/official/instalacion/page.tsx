import type { Metadata } from 'next'
import InstallGuidePage from '@/components/official/install/InstallGuidePage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Instalacion Pine Script · GONOVI AlgoTrend',
  description:
    'Guia completa para cargar, guardar y configurar indicadores AlgoTrend como Pine Script completo en TradingView.',
  alternates: {
    canonical: 'https://gonovi.app/official/instalacion',
  },
  openGraph: {
    title: 'Instalacion Pine Script · GONOVI AlgoTrend',
    description:
      'Como cargar tus indicadores AlgoTrend en TradingView: Pine Editor, alertas, FAQ y soporte directo.',
    url: 'https://gonovi.app/official/instalacion',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Instalacion Pine Script · GONOVI AlgoTrend',
    description:
      'Carga tus indicadores AlgoTrend en TradingView con Pine Script completo, pasos claros, alertas y soporte.',
    images: ['/og-card.png'],
  },
}

export default function InstalacionPage() {
  return <InstallGuidePage />
}
