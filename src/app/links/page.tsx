import type { Metadata } from 'next'
import { LinksPage } from '@/components/links/LinksPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Enlaces | GONOVI',
  description: 'Centro oficial de enlaces de GONOVI: indicadores gratis y PRO, IA AlgoTrend, Fusion X10, comunidad y herramientas para traders.',
  alternates: {
    canonical: 'https://gonovi.app/links',
  },
  openGraph: {
    title: 'Enlaces | GONOVI',
    description: 'Indicadores, herramientas y recursos para traders. Todos los accesos del ecosistema GONOVI en un solo lugar.',
    url: 'https://gonovi.app/links',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'GONOVI · Enlaces' }],
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enlaces | GONOVI',
    description: 'Indicadores, herramientas y recursos para traders. Hub de enlaces oficial GONOVI.',
    images: ['/og-card.png'],
  },
}

export default function Page() {
  return <LinksPage />
}
