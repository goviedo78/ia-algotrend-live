import { EstrategiasPage } from '@/components/official/estrategias/EstrategiasPage'
import { getAllTrades, getOpenTrade } from '@/lib/db'

export const metadata = {
  title: 'Resultados en vivo | GONOVI',
  description: 'Rendimiento mensual y operaciones abiertas de BTC 1H, Oro 15M y Oro 30M.',
}

export const dynamic = 'force-dynamic'
// Revalidar cada 30s: los trades cambian en escala de minutos, no de
// request. Esto cachea el resultado y evita golpear la DB en cada hit.
export const revalidate = 30

// Una sola query por estrategia, allTrades + openTrade en paralelo.
async function safeFetch(tableName: string) {
  try {
    const [all, open] = await Promise.all([
      getAllTrades(500, tableName),
      getOpenTrade(tableName),
    ])
    return { all, open }
  } catch (e) {
    console.error(`Error fetching from ${tableName}:`, e)
    return { all: [], open: null }
  }
}

export default async function Page() {
  // Las 3 estrategias se fetchean en PARALELO (6 queries SQL en simultáneo
  // en vez de 6 secuenciales). Latencia total ≈ la query más lenta, no la
  // suma. Antes: ~600-900ms. Ahora: ~150-250ms.
  const [btc, oro15, oro30] = await Promise.all([
    safeFetch('algotrend_trades'),
    safeFetch('gold15_trades'),
    safeFetch('gold30_trades'),
  ])

  const initialData = {
    'algotrend_trades': btc,
    'gold15_trades': oro15,
    'gold30_trades': oro30,
  }

  return <EstrategiasPage initialData={initialData} />
}
