import { EstrategiasPage } from '@/components/official/estrategias/EstrategiasPage'
import { getCachedStrategySnapshot } from '@/lib/public-cache'

export const metadata = {
  title: 'Resultados en vivo | GONOVI',
  description: 'Rendimiento mensual y operaciones abiertas de BTC 1H, Oro 30M y Oro 15M.',
}

// The public snapshot is shared by all visitors and refreshed in the
// background. This prevents every page view from opening six database queries.
export const dynamic = 'force-static'
export const revalidate = 30

export default async function Page() {
  const initialData = await getCachedStrategySnapshot()
  return <EstrategiasPage initialData={initialData} />
}
