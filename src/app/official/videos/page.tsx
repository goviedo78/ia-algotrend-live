import type { Metadata } from 'next'
import { VideosPage } from '@/components/official/videos/VideosPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Hub de Videos | GONOVI AlgoTrend',
  description: 'Tutoriales, guías y operativas en vivo para dominar AlgoTrend y mejorar tu lectura de mercado. Aprende Pine Script, estrategias y gestión de riesgo.',
  alternates: {
    canonical: 'https://gonovi.app/official/videos',
  },
  openGraph: {
    title: 'Hub de Videos | GONOVI AlgoTrend',
    description: 'Tutoriales de Pine Script, estrategias de trading y gestión de riesgo. Aprende con la comunidad GONOVI.',
    url: 'https://gonovi.app/official/videos',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Hub de Videos' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hub de Videos | GONOVI AlgoTrend',
    description: 'Tutoriales de Pine Script, estrategias de trading y gestión de riesgo para traders.',
    images: ['/og-card.png'],
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Hub de Videos GONOVI',
    description: 'Colección de tutoriales y guías de trading: Pine Script, estrategias, backtesting y gestión de riesgo.',
    url: 'https://gonovi.app/official/videos',
    publisher: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
      sameAs: ['https://www.youtube.com/@gonovi'],
    },
    inLanguage: 'es',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VideosPage />
    </>
  )
}
