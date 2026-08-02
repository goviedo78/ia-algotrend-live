import { EstrategiasPage } from '@/components/official/estrategias/EstrategiasPage'
import { getAllTrades } from '@/lib/db'
import { unstable_cache } from 'next/cache'

export const metadata = {
  title: 'Resultados en vivo | GONOVI',
  description: 'Rendimiento mensual y operaciones abiertas de BTC 1H, Oro 15M y Oro 30M.',
}

// The public snapshot is shared by all visitors and refreshed in the
// background. This prevents every page view from opening six database queries.
export const dynamic = 'force-static'
export const revalidate = 30

// One query per strategy; the open trade is derived from the same snapshot.
// Errors must escape so an interrupted refresh never replaces a valid cached
// snapshot with an empty page.
async function fetchStrategy(tableName: string) {
  const all = await getAllTrades(500, tableName)
  return {
    all,
    open: all.find((trade) => trade.status === 'OPEN') ?? null,
  }
}

const getCachedStrategies = unstable_cache(async () => {
  const [btc, oro15, oro30] = await Promise.all([
    fetchStrategy('algotrend_trades'),
    fetchStrategy('gold15_trades'),
    fetchStrategy('gold30_trades'),
  ])

  return {
    'algotrend_trades': btc,
    'gold15_trades': oro15,
    'gold30_trades': oro30,
  }
}, ['gonovi-public-strategy-snapshot-v1'], {
  revalidate: 30,
  tags: ['algotrend-trades'],
})

export default async function Page() {
  const initialData = await getCachedStrategies()
  return <EstrategiasPage initialData={initialData} />
}
