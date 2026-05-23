import { notFound } from 'next/navigation'
import { EstrategiasPage } from '@/components/official/estrategias/EstrategiasPage'
import { getAllTrades, getOpenTrade } from '@/lib/db'

export const metadata = {
  title: 'Resultados en vivo | GONOVI',
  description: 'Rendimiento mensual y operaciones abiertas de BTC 1H, Oro 15M y Oro 30M.',
}

export const dynamic = 'force-dynamic'

async function safeFetch(tableName: string) {
  try {
    const all = await getAllTrades(500, tableName)
    const open = await getOpenTrade(tableName)
    return { all, open }
  } catch (e) {
    console.error(`Error fetching from ${tableName}:`, e)
    return { all: [], open: null }
  }
}

export default async function Page() {
  if (process.env.OFFICIAL_ENABLED !== 'true') {
    notFound()
  }

  const btc = await safeFetch('algotrend_trades')
  const oro15 = await safeFetch('gold15_trades')
  const oro30 = await safeFetch('gold30_trades')

  const initialData = {
    'algotrend_trades': btc,
    'gold15_trades': oro15,
    'gold30_trades': oro30,
  }

  return <EstrategiasPage initialData={initialData} />
}
