export const BROKER_STRATEGIES = {
  ALGOTREND_BTC_1H: {
    code: 'ALGOTREND_BTC_1H',
    label: 'AlgoTrend BTC 1H',
    symbol: 'BTC-USDT',
    timeframe: '1h',
    assetLabel: 'Bitcoin',
  },
  ALGOTREND_GOLD_30M: {
    code: 'ALGOTREND_GOLD_30M',
    label: 'AlgoTrend Oro 30m',
    symbol: 'NCCOGOLD2USD-USDT',
    timeframe: '30m',
    assetLabel: 'Oro',
  },
} as const

export type BrokerStrategyCode = keyof typeof BROKER_STRATEGIES

export const BROKER_STRATEGY_CODES = Object.keys(BROKER_STRATEGIES) as [
  BrokerStrategyCode,
  ...BrokerStrategyCode[],
]

export function brokerStrategy(code: string) {
  return BROKER_STRATEGIES[code as BrokerStrategyCode] ?? null
}
