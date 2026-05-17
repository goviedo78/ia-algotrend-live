import type { Metadata } from 'next'
import CheckoutPage from '@/components/official/checkout/CheckoutPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Checkout | Script Completo GONOVI AlgoTrend',
  description: 'Adquiere el Pine Script completo de GONOVI AlgoTrend con entrega inmediata por email. Indicadores profesionales con señales, gestión de riesgo y trailing stop automático.',
  alternates: {
    canonical: 'https://gonovi.app/official/checkout',
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Checkout | Script Completo GONOVI',
    description: 'Compra el script completo AlgoTrend con entrega inmediata. Indicadores Pine Script profesionales para TradingView.',
    url: 'https://gonovi.app/official/checkout',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Checkout' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Checkout | Script Completo GONOVI',
    description: 'Adquiere el Pine Script profesional AlgoTrend con entrega inmediata por email.',
    images: ['/og-card.png'],
  },
}

export default function CheckoutRoute() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'GONOVI AlgoTrend Script Completo',
    description: 'Pine Script completo con indicadores AlgoTrend, señales LONG/SHORT, gestión de riesgo automática y trailing stop para TradingView.',
    url: 'https://gonovi.app/official/checkout',
    brand: {
      '@type': 'Brand',
      name: 'GONOVI',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'GONOVI',
        url: 'https://gonovi.app',
      },
    },
    inLanguage: 'es',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CheckoutPage />
    </>
  )
}
