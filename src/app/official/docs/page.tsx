import type { Metadata } from 'next'
import { DocsPage } from '@/components/official/docs/DocsPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Documentación Pine Script | GONOVI AlgoTrend',
  description: 'Guía paso a paso para cargar, configurar y ejecutar los indicadores Pine Script de GONOVI en TradingView. Instalación en menos de 2 minutos.',
  alternates: {
    canonical: 'https://gonovi.app/official/docs',
  },
  openGraph: {
    title: 'Documentación Pine Script | GONOVI AlgoTrend',
    description: 'Cómo instalar y configurar los scripts AlgoTrend en TradingView. Guía completa con capturas y pasos claros.',
    url: 'https://gonovi.app/official/docs',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Documentación Pine Script' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Docs Pine Script | GONOVI',
    description: 'Guía rápida para instalar indicadores GONOVI AlgoTrend en TradingView en menos de 2 minutos.',
    images: ['/og-card.png'],
  },
}

export default function OfficialDocsRoute() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Guía de instalación Pine Script GONOVI AlgoTrend',
    description: 'Instrucciones paso a paso para cargar y configurar indicadores Pine Script de GONOVI en TradingView.',
    url: 'https://gonovi.app/official/docs',
    author: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
    },
    publisher: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
    },
    inLanguage: 'es',
    about: {
      '@type': 'SoftwareApplication',
      name: 'GONOVI AlgoTrend',
      applicationCategory: 'FinanceApplication',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DocsPage />
    </>
  )
}
