import type { Metadata } from 'next'
import MonteCarloAuditor from '@/components/official/montecarlo/MonteCarloAuditor'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Monte Carlo Auditor · GONOVI',
  description:
    'Auditoría estocástica de estrategias de trading. Detecta overfitting con 10.000 simulaciones, drawdown extremo, K-Ratio y probabilidad de ruina.',
  alternates: {
    canonical: 'https://gonovi.app/official/montecarlo',
  },
  openGraph: {
    title: 'Monte Carlo Auditor · GONOVI',
    description:
      'Sube tu CSV de operaciones y verifica si tu estrategia es robusta o sufre de overfitting.',
    url: 'https://gonovi.app/official/montecarlo',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monte Carlo Auditor · GONOVI',
    description:
      'Auditoría estocástica y filtro de overfitting con 10.000 simulaciones Monte Carlo en tu navegador.',
    images: ['/og-card.png'],
  },
}

export default function MonteCarloPage() {
  return <MonteCarloAuditor />
}
