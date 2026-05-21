import { notFound } from 'next/navigation'
import { EstrategiasPage } from '@/components/official/estrategias/EstrategiasPage'

export const metadata = {
  title: 'Estrategias | GONOVI',
  description: 'Cómo está construida cada estrategia y para qué mercado/timeframe sirve.',
}

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.OFFICIAL_ENABLED !== 'true') {
    notFound()
  }
  return <EstrategiasPage />
}
