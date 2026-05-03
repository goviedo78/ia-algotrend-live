export interface AtrCandle {
  high: number
  low: number
  close: number
}

export function calcWilderAtr(candles: AtrCandle[], period: number): number[] {
  const n = candles.length
  const out = new Array<number>(n).fill(NaN)
  if (n === 0 || period <= 0 || n < period) return out

  const trueRanges = new Array<number>(n)
  trueRanges[0] = candles[0].high - candles[0].low

  for (let i = 1; i < n; i++) {
    const highLow = candles[i].high - candles[i].low
    const highPrevClose = Math.abs(candles[i].high - candles[i - 1].close)
    const lowPrevClose = Math.abs(candles[i].low - candles[i - 1].close)
    trueRanges[i] = Math.max(highLow, highPrevClose, lowPrevClose)
  }

  let seed = 0
  for (let i = 0; i < period; i++) seed += trueRanges[i]
  out[period - 1] = seed / period

  for (let i = period; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + trueRanges[i]) / period
  }

  return out
}

export function latestAtrPercent(candles: AtrCandle[], period: number): number | null {
  const atr = calcWilderAtr(candles, period)
  const latestAtr = atr[atr.length - 1]
  const latestClose = candles[candles.length - 1]?.close

  if (
    typeof latestAtr !== 'number'
    || !Number.isFinite(latestAtr)
    || typeof latestClose !== 'number'
    || !Number.isFinite(latestClose)
    || latestClose <= 0
  ) {
    return null
  }

  return (latestAtr / latestClose) * 100
}
