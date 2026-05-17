import type { Metadata } from 'next'
import { CommunityPage } from '@/components/official/community/CommunityPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Comunidad Traders | GONOVI AlgoTrend',
  description: 'Únete a la comunidad de traders de GONOVI. Accede al grupo de WhatsApp, canal de YouTube y soporte directo para traders de futuros y criptomonedas.',
  alternates: {
    canonical: 'https://gonovi.app/official/community',
  },
  openGraph: {
    title: 'Comunidad Traders | GONOVI AlgoTrend',
    description: 'Comunidad activa de traders: señales en vivo, tutoriales, soporte y acceso al canal de YouTube GONOVI.',
    url: 'https://gonovi.app/official/community',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI Comunidad Traders' }],
    type: 'website',
    locale: 'es_MX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comunidad Traders | GONOVI',
    description: 'Únete a la comunidad de traders GONOVI: señales, tutoriales y soporte en WhatsApp y YouTube.',
    images: ['/og-card.png'],
  },
}

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GONOVI Comunidad',
    description: 'Comunidad de traders que utilizan el sistema AlgoTrend para operar futuros y criptomonedas.',
    url: 'https://gonovi.app/official/community',
    sameAs: [
      'https://www.youtube.com/@gonovi',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Community Support',
      availableLanguage: 'Spanish',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CommunityPage />
    </>
  )
}
