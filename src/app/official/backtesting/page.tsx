import type { Metadata } from 'next'
import BacktestingPage from '@/components/official/backtesting/BacktestingPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Backtesting Libre 5M | GONOVI AlgoTrend',
  description: 'Practica backtesting manual vela a vela en escenarios de 5 minutos. Valida estrategias con datos históricos reales y métricas profesionales.',
  alternates: {
    canonical: 'https://gonovi.app/official/backtesting',
  },
  openGraph: {
    title: 'Backtesting Libre 5M | GONOVI AlgoTrend',
    description: 'Backtesting manual vela a vela con escenarios de mercado reales. Calcula win rate, R ratio y drawdown al instante.',
    url: 'https://gonovi.app/official/backtesting',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Backtesting Libre' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backtesting Libre 5M | GONOVI',
    description: 'Practica backtesting manual vela a vela en escenarios de 5 minutos con métricas en tiempo real.',
    images: ['/og-card.png'],
  },
}

export default function BacktestingRoute() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'GONOVI Backtesting Libre',
    description: 'Herramienta de backtesting manual vela a vela para estrategias de trading en temporalidad de 5 minutos.',
    url: 'https://gonovi.app/official/backtesting',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
    },
    inLanguage: 'es',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BacktestingPage />
    </>
  )
}
