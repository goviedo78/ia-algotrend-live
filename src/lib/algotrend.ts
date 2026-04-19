// IA AlgoTrend — TypeScript port of the Pine Script v5 strategy
// SuperTrend + KNN (K-Nearest Neighbors) + PCA
// Defaults mirror ORIGINAL_BASE.pine

export interface Candle {
  time: number   // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface AlgoTrendResult {
  time: number
  close: number

  // SuperTrend
  supertrend: number       // the supertrend line value
  stDirection: number      // -1 bullish, +1 bearish (Pine convention)
  lastStDir: number        // confirmed direction (flips only when KNN agrees)

  // KNN probabilities
  probUp: number           // 0–1
  probDown: number         // 0–1

  // Signals (SuperTrend flip + KNN confirmed)
  longSig: boolean         // bullish signal
  shortSig: boolean        // bearish signal

  // SL / TP
  longStop: number
  longTp: number
  shortStop: number
  shortTp: number

  // ATR
  atrVal: number
}

type MaType = 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'LSMA' | 'WMA' | 'HMA' | 'ZLSMA' | 'SMMA' | 'THMA'
type StopMode = 'SuperTrend' | 'Porcentaje'
type TpMode = 'Ratio R:R' | 'Porcentaje'

// ── Pine default preset (ORIGINAL_BASE.pine) ───────────────────────────────
const PRESET = {
  atrPeriod: 10,
  factor: 2.0,
  kNeighbors: 20,
  samplingWindowSize: 1000,
  momentumWindow: 10,
  probThreshold: 0.85,
  maType: 'EMA' as MaType,
  rsiLen: 25,
  maLen: 100,
  signalLen: 10,
  chopLen: 14,
  windowSize: 1000,
  pParam: 7.0,
  wParam: 2.0,   // Gaussian weight sensitivity
  usePca: true,
  minDisplayProb: 85.0,

  // Risk management defaults (same as Pine strategy)
  slMode: 'Porcentaje' as StopMode,
  slPct: 2.0,
  slOffsetTicks: 5,
  tpMode: 'Ratio R:R' as TpMode,
  tpRR: 1.5,
  tpPct: 4.0,
  tickSize: 1.0,
}

// ── Math helpers ─────────────────────────────────────────────────────────────

// Wilder's ATR
function calcAtr(candles: Candle[], period: number): number[] {
  const n = candles.length
  const tr: number[] = new Array(n)
  tr[0] = candles[0].high - candles[0].low
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low
    const hc = Math.abs(candles[i].high - candles[i - 1].close)
    const lc = Math.abs(candles[i].low - candles[i - 1].close)
    tr[i] = Math.max(hl, hc, lc)
  }
  const out: number[] = new Array(n).fill(NaN)
  if (n < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  out[period - 1] = sum / period
  for (let i = period; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period
  }
  return out
}

// EMA
function calcEma(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = new Array(data.length).fill(NaN)
  // find first non-NaN
  let start = 0
  while (start < data.length && isNaN(data[start])) start++
  if (start >= data.length) return out
  out[start] = data[start]
  for (let i = start + 1; i < data.length; i++) {
    out[i] = isNaN(data[i]) ? NaN : data[i] * k + out[i - 1] * (1 - k)
  }
  return out
}

// SMA (rolling, returns NaN until enough data)
function calcSma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  let sum = 0, count = 0
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(data[i])) { sum += data[i]; count++ }
    if (i >= period && !isNaN(data[i - period])) { sum -= data[i - period]; count-- }
    if (i >= period - 1 && count === period) out[i] = sum / period
  }
  return out
}

// WMA (linearly weighted)
function calcWma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  const denom = (period * (period + 1)) / 2
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0, valid = true
    for (let j = 0; j < period; j++) {
      if (isNaN(data[i - j])) { valid = false; break }
      sum += data[i - j] * (period - j)
    }
    if (valid) out[i] = sum / denom
  }
  return out
}

// HMA = WMA( 2*WMA(n/2) - WMA(n), sqrt(n) )
function calcHma(data: number[], period: number): number[] {
  const halfPeriod = Math.max(1, Math.round(period / 2))
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)))
  const wma1 = calcWma(data, halfPeriod)
  const wma2 = calcWma(data, period)
  const diff = wma1.map((v, i) => isNaN(v) || isNaN(wma2[i]) ? NaN : 2 * v - wma2[i])
  return calcWma(diff, sqrtPeriod)
}

// DEMA = 2*EMA - EMA(EMA)
function calcDema(data: number[], period: number): number[] {
  const ema1 = calcEma(data, period)
  const ema2 = calcEma(ema1, period)
  return ema1.map((v, i) => isNaN(v) || isNaN(ema2[i]) ? NaN : 2 * v - ema2[i])
}

// TEMA = 3 * (EMA1 - EMA2) + EMA3
function calcTema(data: number[], period: number): number[] {
  const ema1 = calcEma(data, period)
  const ema2 = calcEma(ema1, period)
  const ema3 = calcEma(ema2, period)
  return ema1.map((v, i) => {
    if (isNaN(v) || isNaN(ema2[i]) || isNaN(ema3[i])) return NaN
    return 3 * (v - ema2[i]) + ema3[i]
  })
}

// SMMA/RMA (Wilder moving average)
function calcRma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  if (data.length < period) return out
  let sum = 0
  let hasNaN = false
  for (let i = 0; i < period; i++) {
    if (isNaN(data[i])) { hasNaN = true; break }
    sum += data[i]
  }
  if (hasNaN) return out
  out[period - 1] = sum / period
  for (let i = period; i < data.length; i++) {
    if (isNaN(data[i])) continue
    out[i] = (out[i - 1] * (period - 1) + data[i]) / period
  }
  return out
}

// THMA (same shape as Pine helper f_thma)
function calcThma(data: number[], period: number): number[] {
  const l3 = Math.max(1, Math.round(period / 3))
  const l2 = Math.max(1, Math.round(period / 2))
  const w1 = calcWma(data, l3)
  const w2 = calcWma(data, l2)
  const w3 = calcWma(data, period)
  const mix = w1.map((v, i) => {
    if (isNaN(v) || isNaN(w2[i]) || isNaN(w3[i])) return NaN
    return v * 3 - w2[i] - w3[i]
  })
  return calcWma(mix, period)
}

// Linear regression (LSMA)
function calcLinreg(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  for (let i = period - 1; i < data.length; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, valid = true
    for (let j = 0; j < period; j++) {
      if (isNaN(data[i - j])) { valid = false; break }
      const x = j  // 0 = most recent
      sumX += x
      sumY += data[i - j]
      sumXY += x * data[i - j]
      sumX2 += x * x
    }
    if (valid) {
      const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / period
      out[i] = intercept  // value at x=0 (most recent)
    }
  }
  return out
}

// ZLSMA = lsma + (lsma - sma)
function calcZlsma(data: number[], period: number): number[] {
  const lsma = calcLinreg(data, period)
  const sma = calcSma(data, period)
  return lsma.map((v, i) => isNaN(v) || isNaN(sma[i]) ? NaN : v + (v - sma[i]))
}

function calcMa(type: MaType, data: number[], period: number): number[] {
  switch (type) {
    case 'SMA': return calcSma(data, period)
    case 'EMA': return calcEma(data, period)
    case 'DEMA': return calcDema(data, period)
    case 'TEMA': return calcTema(data, period)
    case 'LSMA': return calcLinreg(data, period)
    case 'WMA': return calcWma(data, period)
    case 'HMA': return calcHma(data, period)
    case 'ZLSMA': return calcZlsma(data, period)
    case 'SMMA': return calcRma(data, period)
    case 'THMA': return calcThma(data, period)
    default: return calcSma(data, period)
  }
}

// RSI (Wilder's method)
function calcRsi(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return out
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) avgGain += d; else avgLoss -= d
  }
  avgGain /= period; avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

// CHOP index: Pine formula includes close[1] in range calculation
// 100 * log10(sum(TR, len) / (max(highest_high, close[1]) - min(lowest_low, close[1]))) / log10(len)
function calcChop(candles: Candle[], period: number): number[] {
  const n = candles.length
  const out: number[] = new Array(n).fill(NaN)
  const tr: number[] = new Array(n)
  tr[0] = candles[0].high - candles[0].low
  for (let i = 1; i < n; i++) {
    const hl = candles[i].high - candles[i].low
    const hc = Math.abs(candles[i].high - candles[i - 1].close)
    const lc = Math.abs(candles[i].low - candles[i - 1].close)
    tr[i] = Math.max(hl, hc, lc)
  }
  for (let i = period - 1; i < n; i++) {
    let sumTr = 0, hiHigh = -Infinity, loLow = Infinity
    for (let j = 0; j < period; j++) {
      sumTr += tr[i - j]
      hiHigh = Math.max(hiHigh, candles[i - j].high)
      loLow = Math.min(loLow, candles[i - j].low)
    }
    // Pine: max(ta.highest(high, len), close[1]) - min(ta.lowest(low, len), close[1])
    const prevClose = i > 0 ? candles[i - 1].close : candles[i].close
    const rangeHigh = Math.max(hiHigh, prevClose)
    const rangeLow = Math.min(loLow, prevClose)
    const range = rangeHigh - rangeLow
    if (range > 0 && sumTr > 0) {
      out[i] = 100 * Math.log10(sumTr / range) / Math.log10(period)
    }
  }
  return out
}

// Pine: normalize(src, len) => (src - ta.sma(src[1], len)) / max(ta.stdev(src[1], len), 0.00001)
// ta.stdev uses: sqrt(sma(x^2, n) - sma(x, n)^2) — population stdev via E[X²]-E[X]²
// We use the same formula for numerical parity with Pine
function normalizeArr(data: number[], len: number): number[] {
  const out: number[] = new Array(data.length).fill(NaN)
  for (let i = len; i < data.length; i++) {
    // mean and stdev of data[i-len .. i-1] (exactly len values, NOT including i)
    let sumX = 0, sumX2 = 0, valid = true
    for (let j = 1; j <= len; j++) {
      if (isNaN(data[i - j])) { valid = false; break }
      sumX += data[i - j]
      sumX2 += data[i - j] * data[i - j]
    }
    if (!valid) continue
    const mean = sumX / len
    // Pine ta.stdev formula: sqrt(sma(x^2, n) - sma(x, n)^2)
    const variance = sumX2 / len - mean * mean
    const std = Math.sqrt(Math.max(0, variance))
    if (isNaN(data[i])) continue
    out[i] = (data[i] - mean) / Math.max(std, 0.00001)
  }
  return out
}

// SuperTrend — faithful port of Pine ta.supertrend(factor, atrPeriod)
function calcSupertrend(candles: Candle[], period: number, factor: number): {
  direction: number[]
  line: number[]
} {
  const n = candles.length
  const atrArr = calcAtr(candles, period)
  const direction: number[] = new Array(n).fill(NaN)
  const line: number[] = new Array(n).fill(NaN)

  let prevUpper = NaN, prevLower = NaN, prevLine = NaN

  for (let i = 1; i < n; i++) {
    const atr = atrArr[i]
    if (isNaN(atr)) continue

    const hl2 = (candles[i].high + candles[i].low) / 2
    let upper = hl2 + factor * atr
    let lower = hl2 - factor * atr

    // Band adjustment (can only move in one direction per trend)
    if (!isNaN(prevUpper)) {
      upper = (upper < prevUpper || candles[i - 1].close > prevUpper) ? upper : prevUpper
    }
    if (!isNaN(prevLower)) {
      lower = (lower > prevLower || candles[i - 1].close < prevLower) ? lower : prevLower
    }

    // Direction
    let dir: number
    if (isNaN(prevLine)) {
      dir = 1
    } else if (prevLine === prevUpper) {
      dir = candles[i].close > upper ? -1 : 1
    } else {
      dir = candles[i].close < lower ? 1 : -1
    }

    direction[i] = dir
    line[i] = dir === 1 ? upper : lower

    prevUpper = upper
    prevLower = lower
    prevLine = line[i]
  }
  return { direction, line }
}

function crossedOver(curr: number, prev: number, level: number) {
  return curr > level && prev <= level
}

function crossedUnder(curr: number, prev: number, level: number) {
  return curr < level && prev >= level
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runAlgoTrend(candles: Candle[]): AlgoTrendResult[] {
  const n = candles.length
  const p = PRESET
  const closes = candles.map(c => c.close)

  // ── SuperTrend ──────────────────────────────────────────────────────────────
  const { direction: stDir, line: stLine } = calcSupertrend(candles, p.atrPeriod, p.factor)
  const atrArr = calcAtr(candles, p.atrPeriod)

  // target[i] = direction[i] * -1, zeroed if direction changed in last 5 bars
  const target: number[] = new Array(n).fill(0)
  for (let i = 5; i < n; i++) {
    if (isNaN(stDir[i])) continue
    let consistent = true
    for (let k = 1; k <= 5; k++) {
      if (stDir[i - k] !== stDir[i]) { consistent = false; break }
    }
    target[i] = consistent ? stDir[i] * -1 : 0
  }

  // ── Features ────────────────────────────────────────────────────────────────
  const mw = p.momentumWindow
  const rsiArr = calcRsi(closes, p.rsiLen)
  const maArr = calcMa(p.maType, closes, p.maLen)
  const chopArr = calcChop(candles, p.chopLen)

  // MA deviation: (close[i] - MA[i-1]) / MA[i-1]
  // In Pine: (close - calcMA(type, close[1], len)) / calcMA(...)
  // close[1] shifts MA to use prev bar's data
  const maDev: number[] = new Array(n).fill(NaN)
  for (let i = 1; i < n; i++) {
    // MA at i using previous closes (i.e. MA up to i-1, which equals maArr[i-1])
    const ma = maArr[i - 1]
    if (!isNaN(ma) && ma !== 0) maDev[i] = (closes[i] - ma) / ma
  }

  // RSI signal distance: (rsi - sma(rsi[1], signalLen)) / sma(...)
  // Use previous signalLen RSI values for SMA
  const rsiSigDist: number[] = new Array(n).fill(NaN)
  for (let i = p.signalLen; i < n; i++) {
    let sum = 0, valid = true
    for (let j = 1; j <= p.signalLen; j++) {
      if (isNaN(rsiArr[i - j])) { valid = false; break }
      sum += rsiArr[i - j]
    }
    if (!valid || isNaN(rsiArr[i])) continue
    const smaPrev = sum / p.signalLen
    if (smaPrev === 0) continue
    rsiSigDist[i] = (rsiArr[i] - smaPrev) / smaPrev
  }

  // Multi-horizon: _s = current, _m = shifted by mw, _l = shifted by 2*mw
  const rsiS = rsiArr
  const rsiM = (i: number) => i >= mw ? rsiArr[i - mw] : NaN
  const rsiL = (i: number) => i >= mw * 2 ? rsiArr[i - mw * 2] : NaN
  const maDevS = maDev
  const maDevM = (i: number) => i >= mw ? maDev[i - mw] : NaN
  const maDevL = (i: number) => i >= mw * 2 ? maDev[i - mw * 2] : NaN
  const rsiSdS = rsiSigDist
  const rsiSdM = (i: number) => i >= mw ? rsiSigDist[i - mw] : NaN
  const rsiSdL = (i: number) => i >= mw * 2 ? rsiSigDist[i - mw * 2] : NaN
  const chopS = chopArr
  const chopM = (i: number) => i >= mw ? chopArr[i - mw] : NaN
  const chopL = (i: number) => i >= mw * 2 ? chopArr[i - mw * 2] : NaN

  // Normalize each feature array
  const win = p.windowSize

  // Build raw feature arrays first
  const rawRsiS = rsiS
  const rawRsiM = closes.map((_, i) => rsiM(i))
  const rawRsiL = closes.map((_, i) => rsiL(i))
  const rawMaDevS = maDevS
  const rawMaDevM = closes.map((_, i) => maDevM(i))
  const rawMaDevL = closes.map((_, i) => maDevL(i))
  const rawRsiSdS = rsiSdS
  const rawRsiSdM = closes.map((_, i) => rsiSdM(i))
  const rawRsiSdL = closes.map((_, i) => rsiSdL(i))
  const rawChopS = chopS
  const rawChopM = closes.map((_, i) => chopM(i))
  const rawChopL = closes.map((_, i) => chopL(i))

  // Normalized arrays
  const zRsiS = normalizeArr(rawRsiS, win)
  const zRsiM = normalizeArr(rawRsiM, win)
  const zRsiL = normalizeArr(rawRsiL, win)
  const zMaDevS = normalizeArr(rawMaDevS, win)
  const zMaDevM = normalizeArr(rawMaDevM, win)
  const zMaDevL = normalizeArr(rawMaDevL, win)
  const zRsiSdS = normalizeArr(rawRsiSdS, win)
  const zRsiSdM = normalizeArr(rawRsiSdM, win)
  const zRsiSdL = normalizeArr(rawRsiSdL, win)
  const zChopS = normalizeArr(rawChopS, win)
  const zChopM = normalizeArr(rawChopM, win)
  const zChopL = normalizeArr(rawChopL, win)

  // PCA (4 components, matching Pine exactly)
  const pcaRaw1 = zRsiS.map((_, i) => {
    if (isNaN(zRsiS[i]) || isNaN(zMaDevS[i]) || isNaN(zRsiSdS[i])) return NaN
    return zRsiS[i] + zMaDevS[i] + zRsiSdS[i] * 0.5
  })
  const pcaRaw2 = zRsiM.map((_, i) => {
    if (isNaN(zRsiM[i]) || isNaN(zMaDevM[i]) || isNaN(zRsiSdM[i])) return NaN
    return zRsiM[i] + zMaDevM[i] + zRsiSdM[i] * 0.5
  })
  const pcaRaw3 = zRsiL.map((_, i) => {
    if (isNaN(zRsiL[i]) || isNaN(zMaDevL[i]) || isNaN(zRsiSdL[i])) return NaN
    return zRsiL[i] + zMaDevL[i] + zRsiSdL[i] * 0.5
  })
  const pcaRaw4 = zChopS.map((_, i) => {
    if (isNaN(zChopS[i]) || isNaN(zChopM[i]) || isNaN(zChopL[i])) return NaN
    return zChopS[i] + zChopM[i] * 0.9 + zChopL[i] * 0.8
  })

  let pc1: number[] = []
  let pc2: number[] = []
  let pc3: number[] = []
  let pc4: number[] = []
  if (p.usePca) {
    pc1 = normalizeArr(pcaRaw1, win)
    pc2 = normalizeArr(pcaRaw2, win).map(v => isNaN(v) ? NaN : v * 0.9)
    pc3 = normalizeArr(pcaRaw3, win).map(v => isNaN(v) ? NaN : v * 0.8)
    pc4 = normalizeArr(pcaRaw4, win).map(v => isNaN(v) ? NaN : v * 0.8)
  } else {
    pc1 = zRsiM
    pc2 = zMaDevM
    pc3 = zRsiSdM
    pc4 = zChopM
  }

  // ── KNN ─────────────────────────────────────────────────────────────────────
  const probUp: number[] = new Array(n).fill(0)
  const probDown: number[] = new Array(n).fill(0)
  const stride = mw
  const minStart = win + mw + 1

  for (let i = minStart; i < n; i++) {
    if (isNaN(pc1[i]) || isNaN(pc2[i]) || isNaN(pc3[i]) || isNaN(pc4[i])) continue

    const distances: number[] = []
    const labels: number[] = []

    const lookback = Math.min(p.samplingWindowSize + mw, i - mw)

    for (let offset = mw; offset <= lookback; offset += stride) {
      const j = i - offset
      if (j < 0) break
      if (target[j] === 0) continue
      if (isNaN(pc1[j]) || isNaN(pc2[j]) || isNaN(pc3[j]) || isNaN(pc4[j])) continue

      const d1 = Math.abs(pc1[i] - pc1[j])
      const d2 = Math.abs(pc2[i] - pc2[j])
      const d3 = Math.abs(pc3[i] - pc3[j])
      const d4 = Math.abs(pc4[i] - pc4[j])
      const pp = p.pParam
      const dist = Math.pow(
        Math.pow(d1, pp) + Math.pow(d2, pp) + Math.pow(d3, pp) + Math.pow(d4, pp),
        1 / pp
      )
      distances.push(dist)
      labels.push(target[j])
    }

    if (distances.length < p.kNeighbors) continue

    // Sort by distance
    const indices = distances.map((_, idx) => idx).sort((a, b) => distances[a] - distances[b])

    // Gaussian sigma = median-like pick from fully sorted distance array (Pine behavior)
    const sortedDists = [...distances].sort((a, b) => a - b)
    const sigmaIdx = Math.min(Math.floor(p.kNeighbors / 2), sortedDists.length - 1)
    const sigma = Math.max(sortedDists[sigmaIdx], 0.0001)

    let sumWUp = 0, sumWDown = 0, sumW = 0
    const wp = p.wParam

    for (let j = 0; j < p.kNeighbors; j++) {
      const idx = indices[j]
      const d = distances[idx]
      const lbl = labels[idx]
      const w = Math.exp(-Math.pow(d, wp) / (2 * Math.pow(sigma, 2)))
      if (lbl === 1) sumWUp += w
      if (lbl === -1) sumWDown += w
      sumW += w
    }

    if (sumW > 0) {
      probUp[i] = sumWUp / sumW
      probDown[i] = sumWDown / sumW
    }
  }

  // ── Signal generation ────────────────────────────────────────────────────────
  const results: AlgoTrendResult[] = []
  let lastDir = 0
  let lastStDir = 0

  for (let i = 0; i < n; i++) {
    if (isNaN(stDir[i])) {
      results.push({
        time: candles[i].time, close: closes[i],
        supertrend: stLine[i] ?? NaN, stDirection: stDir[i] ?? NaN,
        lastStDir: 0, probUp: 0, probDown: 0,
        longSig: false, shortSig: false,
        longStop: NaN, longTp: NaN, shortStop: NaN, shortTp: NaN,
        atrVal: atrArr[i] ?? NaN,
      })
      continue
    }

    const prevProbUp = i > 0 ? probUp[i - 1] : 0
    const prevProbDown = i > 0 ? probDown[i - 1] : 0
    const thresh = p.probThreshold

    // Raw KNN threshold crosses
    const rawLong = crossedOver(probUp[i], prevProbUp, thresh)
    const rawShort = crossedOver(probDown[i], prevProbDown, thresh)

    if (rawLong && lastDir <= 0) lastDir = 1
    if (rawShort && lastDir >= 0) lastDir = -1

    // last_stdir update (Pine logic)
    const prevLastStDir = lastStDir
    const prevStDir = i > 0 && !isNaN(stDir[i - 1]) ? stDir[i - 1] : 0
    if (stDir[i] !== prevStDir || rawLong || rawShort) {
      if (stDir[i] < 0 && lastDir === 1 && probUp[i] > thresh) lastStDir = stDir[i] * -1
      if (stDir[i] > 0 && lastDir === -1 && probDown[i] > thresh) lastStDir = stDir[i] * -1
    }

    // Confirmed signals (SuperTrend + KNN)
    const signalLong = crossedOver(lastStDir, prevLastStDir, 0)
    const signalShort = crossedUnder(lastStDir, prevLastStDir, 0)

    // Pine-equivalent entry SL/TP calculation for strategy entries
    const slOffset = p.slOffsetTicks * p.tickSize
    const longStop = p.slMode === 'SuperTrend'
      ? stLine[i] - slOffset
      : closes[i] * (1 - p.slPct / 100) - slOffset
    const shortStop = p.slMode === 'SuperTrend'
      ? stLine[i] + slOffset
      : closes[i] * (1 + p.slPct / 100) + slOffset

    const longRisk = closes[i] - longStop
    const shortRisk = shortStop - closes[i]
    const longTp = p.tpMode === 'Ratio R:R'
      ? closes[i] + longRisk * p.tpRR
      : closes[i] * (1 + p.tpPct / 100)
    const shortTp = p.tpMode === 'Ratio R:R'
      ? closes[i] - shortRisk * p.tpRR
      : closes[i] * (1 - p.tpPct / 100)

    const atrV = atrArr[i] ?? 0

    results.push({
      time: candles[i].time,
      close: closes[i],
      supertrend: stLine[i],
      stDirection: stDir[i],
      lastStDir,
      probUp: probUp[i],
      probDown: probDown[i],
      longSig: signalLong,
      shortSig: signalShort,
      longStop,
      longTp,
      shortStop,
      shortTp,
      atrVal: atrV,
    })
  }

  return results
}

export { PRESET }
