import type { Metadata } from 'next'
import TradingLabPage from '@/components/official/lab/TradingLabPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Trading Lab · GONOVI',
  description:
    'Entrenamiento interactivo de lectura de mercado. Decide si va largo, corto o no operar y compara contra el resultado real.',
  alternates: {
    canonical: 'https://gonovi.app/official/lab',
  },
  openGraph: {
    title: 'Trading Lab · GONOVI',
    description:
      'Practica tu lectura de mercado con escenarios reales. Quiz interactivo de trading para la comunidad GONOVI.',
    url: 'https://gonovi.app/official/lab',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trading Lab · GONOVI',
    description:
      'Entrena lectura de mercado con escenarios interactivos, decision long/short/no operar y resultado en R.',
    images: ['/og-card.png'],
  },
}

export default function LabPage() {
  return <TradingLabPage />
}
