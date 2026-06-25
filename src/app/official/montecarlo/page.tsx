import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import MonteCarloAuditor from '@/components/official/montecarlo/MonteCarloAuditor'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Proyecto Montecarlo · GONOVI',
  description:
    'Auditoría estocástica de estrategias de trading. Detecta overfitting con 10.000 simulaciones, drawdown extremo, K-Ratio y probabilidad de ruina.',
  alternates: {
    canonical: 'https://gonovi.app/official/montecarlo',
  },
  openGraph: {
    title: 'Proyecto Montecarlo · GONOVI',
    description:
      'Sube tu CSV de operaciones y verifica si tu estrategia es robusta o sufre de overfitting.',
    url: 'https://gonovi.app/official/montecarlo',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proyecto Montecarlo · GONOVI',
    description:
      'Auditoría estocástica y filtro de overfitting con 10.000 simulaciones Monte Carlo en tu navegador.',
    images: ['/og-card.png'],
  },
}

// /official/montecarlo está expuesto al público (allowlist en proxy.ts) pero
// el resto del hub sigue bloqueado por el muro Próximamente. Para que un
// visitante público no vea botones que llevan al muro, leemos la cookie
// __gonovi_dev (httpOnly, seteada por el bypass en proxy.ts) y pasamos isAdmin.
// El cliente NO puede falsificar esta cookie porque es httpOnly.
export default async function MonteCarloPage() {
  const expected = process.env.BYPASS_TOKEN
  const store = await cookies()
  const isAdmin = Boolean(expected) && store.get('__gonovi_dev')?.value === expected
  return <MonteCarloAuditor isAdmin={isAdmin} />
}
