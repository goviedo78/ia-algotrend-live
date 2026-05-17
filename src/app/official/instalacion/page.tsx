import type { Metadata } from 'next'
import InstallGuidePage from '@/components/official/install/InstallGuidePage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Instalacion Pine Script · GONOVI AlgoTrend',
  description:
    'Guia completa para cargar, guardar y configurar indicadores AlgoTrend como Pine Script completo en TradingView.',
  alternates: {
    canonical: 'https://gonovi.app/official/instalacion',
  },
  openGraph: {
    title: 'Instalacion Pine Script · GONOVI AlgoTrend',
    description:
      'Como cargar tus indicadores AlgoTrend en TradingView: Pine Editor, alertas, FAQ y soporte directo.',
    url: 'https://gonovi.app/official/instalacion',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Instalacion Pine Script · GONOVI AlgoTrend',
    description:
      'Carga tus indicadores AlgoTrend en TradingView con Pine Script completo, pasos claros, alertas y soporte.',
    images: ['/og-card.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Como instalar AlgoTrend en TradingView',
  description: 'Guia paso a paso para cargar indicadores AlgoTrend como Pine Script completo en TradingView, configurar alertas y empezar a operar.',
  url: 'https://gonovi.app/official/instalacion',
  inLanguage: 'es',
  supply: [
    { '@type': 'HowToSupply', name: 'Cuenta de TradingView' },
    { '@type': 'HowToSupply', name: 'Codigo Pine Script de AlgoTrend' },
  ],
  step: [
    { '@type': 'HowToStep', name: 'Abrir Pine Editor', text: 'Ir a TradingView y abrir el Pine Editor desde la barra inferior.' },
    { '@type': 'HowToStep', name: 'Pegar el codigo', text: 'Copiar el Pine Script completo de AlgoTrend y pegarlo en el editor.' },
    { '@type': 'HowToStep', name: 'Guardar y agregar al grafico', text: 'Guardar el script y hacer click en Agregar al grafico.' },
    { '@type': 'HowToStep', name: 'Configurar alertas', text: 'Crear alertas usando las condiciones del indicador para recibir notificaciones.' },
  ],
  provider: {
    '@type': 'Organization',
    name: 'GONOVI',
    url: 'https://gonovi.app',
  },
}

export default function InstalacionPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <InstallGuidePage />
    </>
  )
}
