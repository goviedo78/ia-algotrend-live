import { unstable_cache } from 'next/cache'
import { getAllTrades, getOpenTrade, getStats } from '@/lib/db'

export const getCachedTradeSnapshot = unstable_cache(
  async () => {
    const [trades, openTrade, stats] = await Promise.all([
      getAllTrades(200),
      getOpenTrade(),
      getStats(),
    ])

    return { trades, openTrade, stats }
  },
  ['algotrend-public-trade-snapshot-v1'],
  {
    revalidate: 5,
    tags: ['algotrend-trades'],
  }
)
