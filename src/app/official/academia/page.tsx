import type { Metadata } from 'next'
import AcademiaPage from '@/components/official/academia/AcademiaPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Educación Interactiva | GONOVI',
  description: 'Retos gráficos y entrenamiento visual para aprender lectura de mercado con feedback inmediato. Entrena tu ojo trader con escenarios reales.',
  alternates: {
    canonical: 'https://gonovi.app/official/academia',
  },
  openGraph: {
    title: 'Educación Interactiva | GONOVI',
    description: 'Entrena lectura de mercado con retos gráficos interactivos, feedback instantáneo y progresión por niveles.',
    url: 'https://gonovi.app/official/academia',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Educación Interactiva' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Educación Interactiva | GONOVI',
    description: 'Retos de lectura de mercado con feedback inmediato. Aprende a leer gráficos como un trader profesional.',
    images: ['/og-card.png'],
  },
}

export default function AcademiaRoute() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'Educación Interactiva GONOVI',
    description: 'Entrenamiento interactivo de lectura de mercado con retos gráficos y feedback inmediato.',
    provider: {
      '@type': 'Organization',
      name: 'GONOVI',
      url: 'https://gonovi.app',
    },
    url: 'https://gonovi.app/official/academia',
    educationalLevel: 'Intermedio',
    inLanguage: 'es',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AcademiaPage />
    </>
  )
}
