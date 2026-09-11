import { unstable_cache } from 'next/cache'
import { getAllTrades, getOpenTrade, getStats } from '@/lib/db'
import type { Trade } from '@/lib/db'

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

// Shared by /official/estrategias (server render) and /api/estrategias
// (client polling), so the database is refreshed at most once per window
// no matter how many visitors are watching.
export interface StrategySnapshotEntry {
  all: Trade[]
  open: Trade | null
}

export interface StrategySnapshot {
  algotrend_trades: StrategySnapshotEntry
  gold15_trades: StrategySnapshotEntry
  gold30_trades: StrategySnapshotEntry
}

// One query per strategy; the open trade is derived from the same snapshot.
// Errors must escape so an interrupted refresh never replaces a valid cached
// snapshot with an empty page.
async function fetchStrategy(tableName: string): Promise<StrategySnapshotEntry> {
  const all = await getAllTrades(500, tableName)
  return {
    all,
    open: all.find((trade) => trade.status === 'OPEN') ?? null,
  }
}

export const getCachedStrategySnapshot = unstable_cache(
  async (): Promise<StrategySnapshot> => {
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
  },
  ['gonovi-public-strategy-snapshot-v1'],
  {
    revalidate: 30,
    tags: ['algotrend-trades'],
  }
)
