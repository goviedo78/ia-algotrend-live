import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'GONOVI',
  url: 'https://gonovi.app',
  logo: 'https://gonovi.app/logo-gon-mark-3d.svg',
  description: 'Hub oficial de GONOVI: indicadores, señales en vivo, Pine Script, educación interactiva y comunidad de traders.',
  sameAs: [
    'https://www.youtube.com/@gonovi',
    'https://algotrend.gonovi.app',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Customer Support',
    availableLanguage: 'Spanish',
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'GONOVI',
  url: 'https://gonovi.app',
  description: 'Hub oficial de GONOVI: indicadores, educación, backtesting y comunidad de traders.',
  inLanguage: 'es',
  publisher: {
    '@type': 'Organization',
    name: 'GONOVI',
    url: 'https://gonovi.app',
  },
}

export default function OfficialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {children}
    </>
  )
}
