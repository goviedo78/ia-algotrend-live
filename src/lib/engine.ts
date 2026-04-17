// 🧠 IA AlgoTrend — TypeScript port of the Pine Script indicator
// Engines: GMMA (trend) + RSI/MACD (momentum) + KNN Probability + Signal gate

export interface Candle {
  time: number   // Unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface EngineResult {
  time: number
  close: number

  // Engine 1 — GMMA
  fastAvg: number
  slowAvg: number
  tBull: boolean
  tBear: boolean
  tStrength: number
  compressed: boolean
  tLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL'

  // GMMA lines (for chart overlay)
  f1: number; f6: number   // fast band edges
  s1: number; s6: number   // slow band edges

  // Engine 2 — Momentum
  rsi: number
  macdHist: number
  momScore: number
  momLabel: 'STRONG' | 'MODERATE' | 'FADING' | 'WEAK'

  // Engine 3 — Probability
  probUp: number
  probDown: number
  confVal: number
  confLabel: 'HIGH' | 'MEDIUM' | 'LOW'
  volCtx: 'QUIET' | 'NORMAL' | 'VOLATILE'
  atrVal: number
  atrRatio: number

  // Engine 4 — Signal gate
  longSig: boolean
  shortSig: boolean

  // SL / TP levels
  longStop: number
  longTp: number
  shortStop: number
  shortTp: number
}

// ── Math helpers ────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = new Array(data.length)
  out[0] = data[0]
  for (let i = 1; i < data.length; i++) {
    out[i] = data[i] * k + out[i - 1] * (1 - k)
  }
  return out
}

function sma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    out[i] = sum / period
  }
  return out
}

function rsi(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return out

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += -diff
  }
  avgGain /= period
  avgLoss /= period

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss
  out[period] = 100 - 100 / (1 + rs0)

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    out[i] = 100 - 100 / (1 + rs)
  }
  return out
}

function atr(candles: Candle[], period: number): number[] {
  const tr: number[] = new Array(candles.length).fill(0)
  tr[0] = candles[0].high - candles[0].low
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low
    const hc = Math.abs(candles[i].high - candles[i - 1].close)
    const lc = Math.abs(candles[i].low - candles[i - 1].close)
    tr[i] = Math.max(hl, hc, lc)
  }
  // Wilder smoothing (same as Pine ta.atr)
  const out: number[] = new Array(candles.length).fill(NaN)
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  out[period - 1] = sum / period
  for (let i = period; i < candles.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period
  }
  return out
}

function highest(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  for (let i = period - 1; i < data.length; i++) {
    let max = -Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(data[j]) && data[j] > max) max = data[j]
    }
    out[i] = max === -Infinity ? NaN : max
  }
  return out
}

// ── Main engine ─────────────────────────────────────────────────────────────

export function runEngine(
  candles: Candle[],
  opts: {
    sensitivity?: 'Low' | 'Medium' | 'High'
    mode?: 'Scalping' | 'Swing'
    probThreshold?: number
  } = {}
): EngineResult[] {
  const { sensitivity = 'Medium', mode = 'Swing', probThreshold = 65 } = opts

  const lookback = mode === 'Scalping' ? 50 : 100
  const sensMult = sensitivity === 'Low' ? 1.5 : sensitivity === 'High' ? 0.7 : 1.0
  const stopM = mode === 'Scalping' ? 1.5 : 2.5
  const tpM = mode === 'Scalping' ? 2.0 : 3.5

  const closes = candles.map(c => c.close)
  const n = closes.length

  // Engine 1 — GMMA
  const F1 = ema(closes, 3);   const F2 = ema(closes, 5)
  const F3 = ema(closes, 8);   const F4 = ema(closes, 13)
  const F5 = ema(closes, 21);  const F6 = ema(closes, 34)
  const S1 = ema(closes, 55);  const S2 = ema(closes, 89)
  const S3 = ema(closes, 144); const S4 = ema(closes, 233)
  const S5 = ema(closes, 377); const S6 = ema(closes, 610)

  // Engine 2 — RSI / MACD
  const RSI = rsi(closes, 10)
  const emaFast = ema(closes, 3)
  const emaSlow = ema(closes, 26)
  const macdLine = emaFast.map((v, i) => v - emaSlow[i])
  const macdSig = ema(macdLine, 1)   // signal period=1 → same as macdLine
  const macdHist = macdLine.map((v, i) => v - macdSig[i])

  // ATR(14)
  const ATR = atr(candles, 14)
  const ATR_SMA = sma(ATR, lookback)

  // MACD histogram normalized peaks
  const absHistNorm = ATR.map((a, i) => a > 0 ? Math.abs(macdHist[i] / a * 100) : 0)
  const histPeak = highest(absHistNorm, lookback)

  // GMMA gap for strength
  const fastAvgs = F1.map((_, i) => (F1[i] + F2[i] + F3[i] + F4[i] + F5[i] + F6[i]) / 6)
  const slowAvgs = S1.map((_, i) => (S1[i] + S2[i] + S3[i] + S4[i] + S5[i] + S6[i]) / 6)
  const gapAbs = fastAvgs.map((f, i) => Math.abs((f - slowAvgs[i]) / closes[i] * 100))
  const gapPeak = highest(gapAbs, lookback)

  const results: EngineResult[] = []
  let lastSignalBar = -999

  for (let i = 0; i < n; i++) {
    const c = closes[i]
    const fastAvg = fastAvgs[i]
    const slowAvg = slowAvgs[i]

    const tBull = fastAvg > slowAvg
    const tBear = fastAvg < slowAvg

    // Strength
    const tStrength = (gapPeak[i] ?? 0) > 0
      ? clamp(gapAbs[i] / gapPeak[i] * 100, 0, 100)
      : 50

    // Compression
    const fastSpan = Math.abs(F1[i] - F6[i]) / c * 100
    const compressed = fastSpan < 0.4 * sensMult

    const tLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
      compressed ? 'NEUTRAL' : tBull ? 'BULLISH' : 'BEARISH'

    // RSI score
    const rsiVal = RSI[i] ?? 50
    const rsiBull = clamp((rsiVal - 30) / 40 * 100, 0, 100)
    const rsiBear = clamp((70 - rsiVal) / 40 * 100, 0, 100)
    const rsiScore = tBull ? rsiBull : tBear ? rsiBear : Math.abs(rsiVal - 50) * 2

    // MACD score
    const histNorm = (ATR[i] ?? 0) > 0 ? macdHist[i] / ATR[i] * 100 : 0
    const histR = (histPeak[i] ?? 0) > 0 ? Math.abs(histNorm) / histPeak[i] * 100 : 50
    const macdAligned = (tBull && macdHist[i] > 0) || (tBear && macdHist[i] < 0)
    const macdScore = macdAligned ? histR : Math.max(0, 50 - histR * 0.5)

    // Momentum fading
    const prevHist = i >= 2 ? macdHist[i - 2] : macdHist[i]
    const momFading = tBull
      ? (macdHist[i] > 0 && macdHist[i] < prevHist)
      : tBear
        ? (macdHist[i] < 0 && macdHist[i] > prevHist)
        : false

    const momScore = clamp(rsiScore * 0.60 + macdScore * 0.40, 0, 100)
    const momLabel: 'STRONG' | 'MODERATE' | 'FADING' | 'WEAK' =
      momScore >= 70 ? 'STRONG' : momFading ? 'FADING' : momScore >= 50 ? 'MODERATE' : 'WEAK'

    // Volatility score (bell-curve around ATR ratio = 1.0)
    const atrAvg = ATR_SMA[i] ?? ATR[i] ?? 1
    const atrRatio = atrAvg > 0 ? (ATR[i] ?? 0) / atrAvg : 1
    let volScore: number
    if (atrRatio < 0.5)       volScore = 25
    else if (atrRatio < 1.0)  volScore = 25 + (atrRatio - 0.5) / 0.5 * 55
    else if (atrRatio < 1.5)  volScore = 80 - (atrRatio - 1.0) / 0.5 * 30
    else                       volScore = Math.max(10, 50 - (atrRatio - 1.5) / 0.5 * 40)

    // Probability fusion
    const probRaw = tStrength * 0.50 + momScore * 0.35 + volScore * 0.15
    const probUp = tBull ? probRaw : tBear ? 100 - probRaw : 50
    const probDown = tBear ? probRaw : tBull ? 100 - probRaw : 50

    const aligned = (tBull && momScore > 55) || (tBear && momScore > 55)
    const confVal = aligned ? probRaw : probRaw * 0.82
    const confLabel: 'HIGH' | 'MEDIUM' | 'LOW' =
      confVal >= 70 ? 'HIGH' : confVal >= 55 ? 'MEDIUM' : 'LOW'

    const volCtx: 'QUIET' | 'NORMAL' | 'VOLATILE' =
      atrRatio < 0.8 ? 'QUIET' : atrRatio < 1.3 ? 'NORMAL' : 'VOLATILE'

    // Signal gate
    const longCond  = tBull && !compressed && momScore > 55 && probUp   >= probThreshold
    const shortCond = tBear && !compressed && momScore > 55 && probDown >= probThreshold
    const cooldown  = i - lastSignalBar >= 5

    const longSig  = longCond  && cooldown
    const shortSig = shortCond && cooldown

    if (longSig || shortSig) lastSignalBar = i

    const atrV = ATR[i] ?? 0

    results.push({
      time: candles[i].time,
      close: c,
      fastAvg, slowAvg, tBull, tBear, tStrength, compressed, tLabel,
      f1: F1[i], f6: F6[i], s1: S1[i], s6: S6[i],
      rsi: rsiVal, macdHist: macdHist[i],
      momScore, momLabel,
      probUp, probDown, confVal, confLabel, volCtx,
      atrVal: atrV, atrRatio,
      longSig, shortSig,
      longStop:  c - atrV * stopM,
      longTp:    c + atrV * tpM,
      shortStop: c + atrV * stopM,
      shortTp:   c - atrV * tpM,
    })
  }

  return results
}
