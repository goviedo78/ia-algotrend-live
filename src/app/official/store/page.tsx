import type { Metadata } from 'next'
import { StorePage } from '@/components/official/store/StorePage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Tienda de Indicadores | GONOVI',
  description: 'Catálogo oficial de scripts, indicadores y herramientas de inteligencia artificial para TradingView. Pine Script completo con señales LONG/SHORT, gestión de riesgo y alertas.',
  alternates: {
    canonical: 'https://gonovi.app/official/store',
  },
  openGraph: {
    title: 'Tienda de Indicadores | GONOVI',
    description: 'Indicadores profesionales para TradingView: señales algorítmicas, gestión de riesgo automática y alertas inteligentes.',
    url: 'https://gonovi.app/official/store',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Tienda de Indicadores' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tienda de Indicadores | GONOVI',
    description: 'Scripts Pine Script profesionales para TradingView con señales algorítmicas y gestión de riesgo automática.',
    images: ['/og-card.png'],
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'GONOVI Store',
    description: 'Tienda oficial de indicadores y scripts de trading para TradingView.',
    url: 'https://gonovi.app/official/store',
    seller: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
    },
    currenciesAccepted: 'USD',
    paymentAccepted: 'Credit Card, Gumroad',
    inLanguage: 'es',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StorePage />
    </>
  )
}
