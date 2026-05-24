'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Upload,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Database,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import shellStyles from '../official-home.module.css'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

type Veredicto =
  | 'EXPECTATIVA NEGATIVA'
  | 'RESISTENCIA EXCELENTE'
  | 'RESISTENCIA MODERADA'
  | 'RIESGO ELEVADO'
  | 'RIESGO CRÍTICO'

type PhaseStatus = 'check' | 'warning' | 'danger'

type Phase = {
  key: string
  emoji: string
  name: string
  val: string
  status: PhaseStatus
  statusText: string
  note: string
}

type AuditData = {
  nTrades: number
  winRate: number
  expectancy: number // % por trade
  expectancyCash: number // $ por trade (0 si isPercent)
  sharpe: number
  kRatio: number
  probProfit: number
  probRuin20: number
  probRuin30: number
  probRuin50: number
  dd50: number
  dd95: number
  dd99: number
  medianCap: number
  initialCapital: number
  iterations: number
  isPercent: boolean
  years: number
  samplePaths: number[][]
  maxDrawdowns: number[]
  veredicto: Veredicto
  veredictoTitle: string
  veredictoText: string
  phases: Phase[]
}

type ParsedCSV = {
  lines: string[]
  delimiter: string
  headers: string[]
  autoPnlCol: number
  autoTypeCol: number
  autoDateCol: number
}

type SimSettings = {
  initialCapital: number
  commission: number
  iterations: number
  inputType: 'auto' | 'percent' | 'money'
  pnlCol: number
  typeCol: number
  dateCol: number
}

const STRATEGY_NAME_MAX = 100
const MAX_CSV_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_CSV_ROWS = 10_000
const MAX_CELL_LEN = 500
const MAX_TRADE_RETURN_PCT = 1_000 // sanity: no trade > ±1000%
const ALLOWED_MIME = new Set(['text/csv', 'application/vnd.ms-excel', 'application/csv', ''])
const MAX_STORED_AUDITS = 5
const RETENTION_DAYS = 30
const MAX_ITERATIONS = 50_000
const MIN_ITERATIONS = 100
const MAX_CAPITAL = 100_000_000
const MAX_COMMISSION_PCT = 10

// Anti CSV / Formula injection: si Excel/Sheets abren el archivo y la celda
// empieza con = + - @ \t \r, evalúa la fórmula. Prefijamos con apóstrofe.
const sanitizeForExcel = (raw: string): string => {
  const trimmed = raw.replace(/[\x00-\x1f\x7f]/g, '').trim()
  return /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed
}

const CURRENCY_REGEX = /\b(USD|EUR|BTC|GBP|CHF|CAD|AUD|MXN|ARS|CLP)\b/gi
const TYPE_CANDIDATES = ['tipo', 'type', 'action', 'acción', 'operacion', 'operación']
const PNL_CANDIDATES = [
  'pyg netas %', 'p&g netas %', 'pyg netas', 'p&g netas',
  'net profit %', 'net profit', 'p/l %', 'p&l %', 'p/l', 'p&l',
  'profit %', 'profit', 'ganancia %', 'ganancia', 'rendimiento %', 'rendimiento',
  'retorno %', 'retorno', 'pnl %', 'pnl', 'gain', 'pct',
]
const DATE_CANDIDATES = ['fecha', 'date', 'time', 'timestamp', 'hora', 'datetime']
const ADMIN_PATTERN =
  /balance|credit|deposit|withdraw|swap|comisi|intere|tax|funding|transf|ajuste|fee/i

const cleanNumeric = (raw: string): number | null => {
  if (typeof raw !== 'string') return null
  let s = raw.replace(CURRENCY_REGEX, '')
  s = s.replace(/[%$€£¥\s]/g, '').trim()
  // Notación contable: (120.00) -> -120.00
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim()
    if (s.length > 0 && !s.startsWith('-')) s = '-' + s
  }
  // EU vs US decimal separator
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const val = parseFloat(s)
  return Number.isFinite(val) ? val : null
}

const getMean = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length

const getStdDev = (arr: number[], mean: number): number => {
  if (arr.length < 2) return 0
  const sumSq = arr.reduce((a, b) => a + (b - mean) ** 2, 0)
  return Math.sqrt(sumSq / (arr.length - 1))
}

// linregress sobre log(curve) -> slope + stdErrSlope para K-Ratio
const runLogLinregress = (
  curve: number[],
): { slope: number; stdErrSlope: number } => {
  const n = curve.length
  if (n < 3) return { slope: 0, stdErrSlope: 0 }
  const y: number[] = new Array(n)
  for (let i = 0; i < n; i++) y[i] = Math.log(Math.max(curve[i], 1e-5))
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += y[i]
    sumXY += i * y[i]
    sumXX += i * i
  }
  const meanX = sumX / n
  const meanY = sumY / n
  const den = sumXX - n * meanX * meanX
  if (den === 0) return { slope: 0, stdErrSlope: 0 }
  const slope = (sumXY - n * meanX * meanY) / den
  const intercept = meanY - slope * meanX

  let sumResidualsSq = 0
  let sumXDiffSq = 0
  for (let i = 0; i < n; i++) {
    const predY = slope * i + intercept
    sumResidualsSq += (y[i] - predY) ** 2
    sumXDiffSq += (i - meanX) ** 2
  }
  const sErr = n > 2 ? Math.sqrt(sumResidualsSq / (n - 2)) : 0
  const stdErrSlope = sumXDiffSq > 0 ? sErr / Math.sqrt(sumXDiffSq) : 0
  return { slope, stdErrSlope }
}

// MT19937 (Mersenne Twister) — idéntico al PRNG de NumPy.
// Con semilla 42 produce los mismos resultados que np.random.seed(42),
// garantizando que el web y el Python den auditorías bit-a-bit idénticas.
class MT19937 {
  private mt: number[]
  private index: number
  constructor(seed: number) {
    this.mt = new Array(624)
    this.index = 624
    this.mt[0] = seed >>> 0
    for (let i = 1; i < 624; i++) {
      const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30)
      this.mt[i] = (Math.imul(1812433253, s) + i) >>> 0
    }
  }
  private twist() {
    for (let i = 0; i < 624; i++) {
      const y = (this.mt[i] & 0x80000000) | (this.mt[(i + 1) % 624] & 0x7fffffff)
      this.mt[i] = (this.mt[(i + 397) % 624] ^ (y >>> 1)) >>> 0
      if (y % 2 !== 0) this.mt[i] = (this.mt[i] ^ 0x9908b0df) >>> 0
    }
    this.index = 0
  }
  next(): number {
    if (this.index >= 624) this.twist()
    let y = this.mt[this.index++]
    y ^= y >>> 11
    y ^= (y << 7) & 0x9d2c5680
    y ^= (y << 15) & 0xefc60000
    y ^= y >>> 18
    return y >>> 0
  }
}

// Muestreo uniforme en [0, max] inclusive — idéntico a np.random.randint(0, max+1).
const rkInterval = (max: number, mt: MT19937): number => {
  if (max === 0) return 0
  let mask = max >>> 0
  mask |= mask >>> 1
  mask |= mask >>> 2
  mask |= mask >>> 4
  mask |= mask >>> 8
  mask |= mask >>> 16
  while (true) {
    const val = (mt.next() & mask) >>> 0
    if (val <= max) return val
  }
}

// Percentil con interpolación lineal — igual a np.percentile(arr, q, method="linear").
const getPercentile = (sortedArr: number[], q: number): number => {
  if (sortedArr.length === 0) return 0
  const idx = (sortedArr.length - 1) * (q / 100.0)
  const low = Math.floor(idx)
  const high = Math.ceil(idx)
  const frac = idx - low
  if (high >= sortedArr.length) return sortedArr[low]
  return sortedArr[low] + frac * (sortedArr[high] - sortedArr[low])
}

const findCols = (
  hdrs: string[],
): { tC: number; pC: number; dC: number } => {
  let tC = -1
  let pC = -1
  let dC = -1
  hdrs.forEach((h, idx) => {
    const hL = h.toLowerCase().trim()
    if (tC === -1 && TYPE_CANDIDATES.includes(hL)) tC = idx
    if (pC === -1 && PNL_CANDIDATES.includes(hL)) {
      if (!['cum', 'cumulative', 'acumulad', 'running', 'total', 'saldo', 'balance']
        .some(excl => hL.includes(excl))) {
        pC = idx
      }
    }
    if (dC === -1 && DATE_CANDIDATES.includes(hL)) dC = idx
  })
  if (tC === -1) {
    hdrs.forEach((h, idx) => {
      const hL = h.toLowerCase()
      if (tC === -1 && (hL.includes('tipo') || hL.includes('type') || hL.includes('action'))) tC = idx
    })
  }
  if (pC === -1) {
    hdrs.forEach((h, idx) => {
      const hL = h.toLowerCase()
      const excluded = ['cum', 'cumulative', 'acumulad', 'running', 'total', 'saldo', 'balance']
        .some(excl => hL.includes(excl))
      if (excluded) return
      if (
        pC === -1 &&
        (hL.includes('pyg') || hL.includes('p&l') || hL.includes('p/l') ||
          hL.includes('profit') || hL.includes('net') || hL.includes('pnl') ||
          hL.includes('ganancia') || hL.includes('rendimiento') || hL.includes('retorno') ||
          hL.includes('gain'))
      ) pC = idx
    })
  }
  if (dC === -1) {
    hdrs.forEach((h, idx) => {
      const hL = h.toLowerCase()
      if (dC === -1 && (hL.includes('fecha') || hL.includes('date') || hL.includes('time'))) dC = idx
    })
  }
  return { tC, pC, dC }
}

const parseCSV = (text: string): ParsedCSV => {
  if (text.includes('\0')) {
    throw new Error('Archivo binario detectado. Subí un CSV de texto plano.')
  }
  const rawLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (rawLines.length === 0) throw new Error('El archivo CSV está vacío.')
  if (rawLines.length > MAX_CSV_ROWS) {
    throw new Error(`El CSV tiene más de ${MAX_CSV_ROWS} filas. Recortalo.`)
  }
  let delimiter = ','
  let headers = rawLines[0].split(',')
  let detected = findCols(headers)
  if (detected.pC === -1) {
    headers = rawLines[0].split(';')
    delimiter = ';'
    detected = findCols(headers)
  }
  let pnlCol = detected.pC
  if (pnlCol === -1 && headers.length === 1) pnlCol = 0
  if (pnlCol === -1) {
    throw new Error(
      'No se detectó columna de ganancia/PnL. Columnas detectadas: ' + headers.join(', '),
    )
  }
  return {
    lines: rawLines,
    delimiter,
    headers,
    autoPnlCol: pnlCol,
    autoTypeCol: detected.tC,
    autoDateCol: detected.dC,
  }
}

const detectIsPercent = (
  parsed: ParsedCSV,
  pnlCol: number,
  inputType: SimSettings['inputType'],
): boolean => {
  if (inputType === 'percent') return true
  if (inputType === 'money') return false
  const header = (parsed.headers[pnlCol] ?? '').toLowerCase()
  if (header.includes('%') || header.includes('pct') || header.includes('percent') || header.includes('porcentaje')) {
    return true
  }
  if (header.includes('$') || header.includes('€') || header.includes('£') || header.includes('¥') ||
      /\b(USD|EUR|BTC|GBP|CHF|CAD|AUD|MXN|ARS|CLP)\b/i.test(parsed.headers[pnlCol] ?? '')) {
    return false
  }
  // Inspeccionar celdas
  let hasPercent = false
  let hasCurrency = false
  let maxAbs = 0
  let validCount = 0
  for (let i = 1; i < parsed.lines.length; i++) {
    const cols = parsed.lines[i].split(parsed.delimiter)
    if (cols.length <= pnlCol) continue
    const cell = cols[pnlCol]
    if (cell.length > MAX_CELL_LEN) continue
    const cellLower = cell.toLowerCase()
    if (cellLower.includes('%')) { hasPercent = true; break }
    if (
      cellLower.includes('$') || cellLower.includes('€') || cellLower.includes('£') ||
      cellLower.includes('¥') || /\b(USD|EUR|BTC|GBP|CHF|CAD|AUD|MXN|ARS|CLP)\b/i.test(cell)
    ) hasCurrency = true
    const val = cleanNumeric(cell)
    if (val !== null) {
      maxAbs = Math.max(maxAbs, Math.abs(val))
      validCount++
    }
  }
  if (hasPercent) return true
  if (hasCurrency) return false
  if (validCount > 0 && maxAbs <= 100.0) return true
  return false
}

const extractReturns = (
  parsed: ParsedCSV,
  settings: SimSettings,
): { returnsRaw: number[]; years: number; isPercent: boolean } => {
  const { lines, delimiter } = parsed
  const { pnlCol, typeCol, dateCol } = settings
  const isPercent = detectIsPercent(parsed, pnlCol, settings.inputType)

  // ¿La columna tipo tiene marcas Salida/Exit explícitas?
  let hasExitMarks = false
  if (typeCol !== -1) {
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter)
      if (cols.length <= typeCol) continue
      const action = cols[typeCol].toLowerCase().trim()
      if (action.length > MAX_CELL_LEN) continue
      if (action.startsWith('salida') || action.startsWith('exit')) {
        hasExitMarks = true
        break
      }
    }
  }

  const returnsRaw: number[] = []
  let minDate = Number.POSITIVE_INFINITY
  let maxDate = Number.NEGATIVE_INFINITY
  let skippedSanity = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    if (cols.length <= pnlCol) continue

    if (typeCol !== -1 && cols.length > typeCol) {
      const action = cols[typeCol].toLowerCase().trim()
      if (action.length > MAX_CELL_LEN) continue
      if (hasExitMarks) {
        if (!action.startsWith('salida') && !action.startsWith('exit')) continue
      } else {
        if (ADMIN_PATTERN.test(action)) continue
      }
    }

    if (dateCol !== -1 && cols.length > dateCol) {
      const dateStr = cols[dateCol].trim()
      if (dateStr.length > 0 && dateStr.length < MAX_CELL_LEN) {
        const ts = Date.parse(dateStr)
        if (!Number.isNaN(ts)) {
          if (ts < minDate) minDate = ts
          if (ts > maxDate) maxDate = ts
        }
      }
    }

    const cell = cols[pnlCol]
    if (cell.length > MAX_CELL_LEN) continue
    const val = cleanNumeric(cell)
    if (val === null) continue
    // En modo percent: sanity ±MAX_TRADE_RETURN_PCT%
    if (isPercent && Math.abs(val) > MAX_TRADE_RETURN_PCT) {
      skippedSanity++
      continue
    }
    returnsRaw.push(val)
  }

  if (returnsRaw.length < 10) {
    throw new Error(
      `Solo ${returnsRaw.length} operaciones válidas. Mínimo 10 para una auditoría confiable.`,
    )
  }
  if (skippedSanity > 0) {
    console.warn(`[MonteCarlo] ${skippedSanity} filas descartadas por valores fuera de ±${MAX_TRADE_RETURN_PCT}%.`)
  }

  let years = 1.0
  if (Number.isFinite(minDate) && Number.isFinite(maxDate) && maxDate > minDate) {
    const diffDays = Math.ceil((maxDate - minDate) / 86_400_000)
    if (diffDays > 1) years = diffDays / 365.25
  }
  if (years < 0.01) years = 1.0
  return { returnsRaw, years, isPercent }
}

const buildPhases = (
  expectancy: number,
  expectancyCash: number,
  isPercent: boolean,
  sharpe: number,
  kRatio: number,
  probRuin20: number,
  probRuin30: number,
  probRuin50: number,
  dd95: number,
  iterations: number,
): Phase[] => [
  {
    key: 'expectancy',
    emoji: '🎯',
    name: 'Esperanza Matemática',
    val: isPercent
      ? `En promedio, la estrategia genera ${expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}% netos por operación.`
      : `En promedio, la estrategia genera ${expectancyCash >= 0 ? '+' : ''}$${expectancyCash.toFixed(2)} netos (${expectancy.toFixed(2)}%) por operación.`,
    status: expectancy > 0.1 ? 'check' : expectancy > 0.0 ? 'warning' : 'danger',
    statusText: expectancy > 0.1 ? 'EXPECTATIVA ALTA' : expectancy > 0.0 ? 'EXPECTATIVA DÉBIL' : 'EXPECTATIVA NEGATIVA',
    note: expectancy > 0.1
      ? 'La estrategia muestra una esperanza matemática positiva y favorable.'
      : expectancy > 0.0
        ? 'Margen estrecho. Deslizamientos y comisiones reales podrían comprometer la rentabilidad.'
        : 'El promedio histórico de retornos es negativo. Pérdida neta sistemática.',
  },
  {
    key: 'sharpe',
    emoji: '⚖️',
    name: 'Eficiencia Retorno / Riesgo (Sharpe)',
    val: `La estrategia genera ${sharpe.toFixed(2)} unidades de retorno por unidad de desviación estándar anualizada.`,
    status: sharpe >= 1.5 ? 'check' : sharpe >= 1.0 ? 'warning' : 'danger',
    statusText: sharpe >= 1.5 ? 'VOLATILIDAD BAJA' : sharpe >= 1.0 ? 'VOLATILIDAD MODERADA' : 'VOLATILIDAD ELEVADA',
    note: sharpe >= 1.5
      ? 'Retornos consistentes con baja desviación estándar.'
      : sharpe >= 1.0
        ? 'Rendimiento aceptable con fluctuaciones de capital moderadas.'
        : 'Desviación estándar alta en relación con el beneficio promedio. Mayor riesgo.',
  },
  {
    key: 'kratio',
    emoji: '📐',
    name: 'Consistencia (K-Ratio)',
    val: `La curva de capital tiene una consistencia lineal del ${kRatio.toFixed(3)} sobre escala logarítmica.`,
    status: kRatio >= 1.5 ? 'check' : kRatio >= 1.0 ? 'warning' : 'danger',
    statusText: kRatio >= 1.5 ? 'EXCELENTE LINEALIDAD' : kRatio >= 1.0 ? 'LINEALIDAD ACEPTABLE' : 'LINEALIDAD DÉBIL',
    note: kRatio >= 1.5
      ? 'Crecimiento lineal y altamente regular en escala logarítmica.'
      : kRatio >= 1.0
        ? 'La curva asciende, pero muestra periodos planos prolongados o saltos irregulares.'
        : 'Crecimiento altamente irregular. El rendimiento depende de pocos eventos atípicos.',
  },
  {
    key: 'ruin',
    emoji: '🎲',
    name: 'Riesgo de Ruina Simulado',
    val: `Frecuencia observada de ruina (DD > 30%): ${probRuin30.toFixed(2)}% en ${iterations.toLocaleString('es-AR')} simulaciones.`,
    status: probRuin30 === 0 ? 'check' : probRuin30 <= 1.0 ? 'warning' : 'danger',
    statusText: probRuin30 === 0 ? 'BAJO IMPACTO' : probRuin30 <= 1.0 ? 'RIESGO MODERADO' : 'RIESGO ELEVADO',
    note: `Frecuencia de trayectorias con caídas superiores a: Prop Firm (>20% DD): ${probRuin20.toFixed(2)}% · Frontera Retail (>30% DD): ${probRuin30.toFixed(2)}% · Clásica (>50% DD): ${probRuin50.toFixed(2)}%.`,
  },
  {
    key: 'dd95',
    emoji: '📉',
    name: 'Peor Escenario Extremo (Drawdown p95)',
    val: `Caída máxima estimada en el percentil 95% de simulaciones: ${dd95.toFixed(1)}%.`,
    status: dd95 < 10.0 ? 'check' : dd95 < 20.0 ? 'warning' : dd95 < 35.0 ? 'warning' : 'danger',
    statusText: dd95 < 10.0 ? 'EXCELENTE' : dd95 < 20.0 ? 'MODERADO' : dd95 < 35.0 ? 'RIESGO ALTO' : 'CRÍTICO',
    note: 'El percentil 95% indica el techo de pérdidas para el 95% de las trayectorias. Si supera el 20-35%, sugiere sensibilidad al orden de los trades (posible overfitting).',
  },
]

const buildVerdict = (
  expectancy: number,
  dd95: number,
  iterations: number,
): { veredicto: Veredicto; title: string; text: string } => {
  if (expectancy <= 0) {
    return {
      veredicto: 'EXPECTATIVA NEGATIVA',
      title: '❌ EXPECTATIVA MATEMÁTICA NEGATIVA / NO OPERABLE',
      text: 'La estrategia presenta retornos netos promedio menores o iguales a cero. Expectativa de beneficio desfavorable.',
    }
  }
  if (dd95 < 10.0) {
    return {
      veredicto: 'RESISTENCIA EXCELENTE',
      title: '✅ RESISTENCIA EXCELENTE AL STRESS-TEST',
      text: `En el histórico analizado, la estrategia muestra expectativa positiva, bajo drawdown y buena resistencia al stress-test por remuestreo en ${iterations.toLocaleString('es-AR')} trayectorias.`,
    }
  }
  if (dd95 < 20.0) {
    return {
      veredicto: 'RESISTENCIA MODERADA',
      title: '⚠️ RESISTENCIA MODERADA AL STRESS-TEST',
      text: `El drawdown en el percentil 95% se estima en un rango intermedio (${dd95.toFixed(1)}%). Se aconsejan controles de apalancamiento conservadores.`,
    }
  }
  if (dd95 < 35.0) {
    return {
      veredicto: 'RIESGO ELEVADO',
      title: '🔶 RIESGO DE STRESS-TEST ELEVADO',
      text: `Drawdown máximo simulado de ${dd95.toFixed(1)}% en escenarios adversos. Reducir tamaño de posición para mitigar caídas severas.`,
    }
  }
  return {
    veredicto: 'RIESGO CRÍTICO',
    title: '❌ RIESGO DE STRESS-TEST CRÍTICO / POSIBLE SOBREAJUSTE',
    text: `Se estiman caídas superiores al 35% (${dd95.toFixed(1)}%) en el percentil 95%, lo que indica alta vulnerabilidad ante secuencias desfavorables de operaciones.`,
  }
}

const runMonteCarloSim = (
  returnsRaw: number[],
  isPercent: boolean,
  years: number,
  settings: SimSettings,
): AuditData => {
  const { initialCapital, commission, iterations } = settings
  const nTrades = returnsRaw.length

  // Comisiones / deslizamiento por operación
  let returnsPct: number[]
  let returnsMoney: number[] | null
  if (isPercent) {
    returnsPct = returnsRaw.map((r) => r - commission)
    returnsMoney = null
  } else {
    const commissionCash = (commission / 100.0) * initialCapital
    returnsMoney = returnsRaw.map((r) => r - commissionCash)
    returnsPct = returnsMoney.map((r) => (r / initialCapital) * 100.0)
  }

  // Métricas básicas
  const wins = returnsPct.filter((r) => r > 0)
  const losses = returnsPct.filter((r) => r < 0).map(Math.abs)
  const winRate = wins.length / nTrades
  const lossRate = losses.length / nTrades
  const avgWin = wins.length > 0 ? getMean(wins) : 0
  const avgLoss = losses.length > 0 ? getMean(losses) : 0
  const expectancy = winRate * avgWin - lossRate * avgLoss

  let expectancyCash = 0
  if (!isPercent && returnsMoney) {
    const winsMoney = returnsMoney.filter((r) => r > 0)
    const lossesMoney = returnsMoney.filter((r) => r < 0).map(Math.abs)
    const avgWinCash = winsMoney.length > 0 ? getMean(winsMoney) : 0
    const avgLossCash = lossesMoney.length > 0 ? getMean(lossesMoney) : 0
    expectancyCash = winRate * avgWinCash - lossRate * avgLossCash
  }

  // Sharpe Ratio anualizado con años reales detectados del CSV
  const meanRet = getMean(returnsPct)
  const stdRet = getStdDev(returnsPct, meanRet)
  const tradesPerYear = nTrades / years
  const sharpe = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(tradesPerYear) : 0

  // Curva de capital original + K-Ratio sobre log(curve)
  let cap = initialCapital
  const origCurve: number[] = [cap]
  if (isPercent) {
    for (const r of returnsPct) {
      cap = cap * (1 + r / 100)
      if (cap < 0) cap = 0
      origCurve.push(cap)
    }
  } else {
    for (const r of returnsMoney!) {
      cap = cap + r
      if (cap < 0) cap = 0
      origCurve.push(cap)
    }
  }
  const reg = runLogLinregress(origCurve)
  const kRatio =
    reg.stdErrSlope > 0 ? reg.slope / (reg.stdErrSlope * Math.sqrt(origCurve.length)) : 0

  // SIMULACIÓN DE MONTECARLO con Block Bootstrap (mantiene rachas)
  const finalBalances: number[] = []
  const maxDrawdowns: number[] = []
  let ruin20 = 0
  let ruin30 = 0
  let ruin50 = 0
  const samplePaths: number[][] = []
  const mt = new MT19937(42) // PRNG idéntico a NumPy → resultados reproducibles cross-platform
  const blockSize = Math.max(1, Math.floor(Math.sqrt(nTrades) / 2))
  const nBlocks = Math.ceil(nTrades / blockSize)
  const maxValForInterval = nTrades - blockSize
  const sourceReturns = isPercent ? returnsPct : returnsMoney!

  for (let i = 0; i < iterations; i++) {
    // Block Bootstrap: tomar nBlocks bloques contiguos de tamaño blockSize
    const simReturns: number[] = []
    for (let b = 0; b < nBlocks; b++) {
      const start = rkInterval(maxValForInterval, mt)
      for (let o = 0; o < blockSize; o++) {
        if (simReturns.length < nTrades) {
          simReturns.push(sourceReturns[start + o])
        }
      }
    }

    let simCap = initialCapital
    const simPath: number[] = [simCap]
    let peak = simCap
    let maxDD = 0

    for (let t = 0; t < nTrades; t++) {
      const ret = simReturns[t]
      if (isPercent) {
        simCap = simCap * (1 + ret / 100)
      } else {
        simCap = simCap + ret
      }
      if (simCap < 0) simCap = 0
      simPath.push(simCap)
      if (simCap > peak) peak = simCap
      const dd = peak > 0 ? ((peak - simCap) / peak) * 100 : 100.0
      if (dd > maxDD) maxDD = dd
    }

    finalBalances.push(simCap)
    maxDrawdowns.push(maxDD)
    if (maxDD >= 20.0) ruin20++
    if (maxDD >= 30.0) ruin30++
    if (maxDD >= 50.0) ruin50++
    if (i < 30) samplePaths.push(simPath)
  }

  // Percentiles con interpolación lineal NumPy-compatible (vs nearest-rank).
  const sortedDD = [...maxDrawdowns].sort((a, b) => a - b)
  const sortedBal = [...finalBalances].sort((a, b) => a - b)
  const dd50 = getPercentile(sortedDD, 50)
  const dd95 = getPercentile(sortedDD, 95)
  const dd99 = getPercentile(sortedDD, 99)
  const medianCap = getPercentile(sortedBal, 50)
  const probProfit =
    (finalBalances.filter((b) => b > initialCapital).length / iterations) * 100
  const probRuin20 = (ruin20 / iterations) * 100
  const probRuin30 = (ruin30 / iterations) * 100
  const probRuin50 = (ruin50 / iterations) * 100

  const phases = buildPhases(
    expectancy, expectancyCash, isPercent, sharpe, kRatio,
    probRuin20, probRuin30, probRuin50, dd95, iterations,
  )
  const v = buildVerdict(expectancy, dd95, iterations)

  return {
    nTrades, winRate, expectancy, expectancyCash,
    sharpe, kRatio, probProfit,
    probRuin20, probRuin30, probRuin50,
    dd50, dd95, dd99, medianCap,
    initialCapital, iterations, isPercent, years,
    samplePaths, maxDrawdowns,
    veredicto: v.veredicto, veredictoTitle: v.title, veredictoText: v.text,
    phases,
  }
}

const clampNumber = (val: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(val)) return fallback
  return Math.min(max, Math.max(min, val))
}

// Tooltip rico con descripción + ejemplo. Hover desktop + focus/tap mobile.
// Usa "named group" /tip para no engancharse con groups ancestros (ej. el <details>).
// align controla la posición horizontal en grids para que no se solapen entre sí.
type TooltipAlign = 'left' | 'center' | 'right'
function InfoTooltip({
  title,
  body,
  example,
  align = 'center',
}: {
  title: string
  body: string
  example: string
  align?: TooltipAlign
}) {
  const alignCls =
    align === 'left' ? 'left-0'
    : align === 'right' ? 'right-0'
    : 'left-1/2 -translate-x-1/2'
  return (
    <span className="relative inline-block group/tip ml-1.5 align-middle">
      <span
        role="button"
        aria-label={`Info: ${title}`}
        tabIndex={0}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 hover:bg-blue-500 focus:bg-blue-500 text-slate-200 text-[10px] font-bold cursor-help focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
      >
        ?
      </span>
      <div
        role="tooltip"
        className={`invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 absolute z-50 bottom-full mb-2 ${alignCls} w-64 max-w-[calc(100vw-2rem)] p-3 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300 leading-relaxed pointer-events-none transition-opacity duration-150`}
      >
        <p className="font-bold text-slate-100 mb-1.5">{title}</p>
        <p className="mb-2">{body}</p>
        <p className="text-[11px] text-emerald-400 italic">{example}</p>
      </div>
    </span>
  )
}

const TOOLTIPS = {
  capital: {
    title: 'Capital inicial',
    body: 'Dinero con el que arranca la simulación. Afecta el cálculo de comisiones en modo $ y la mediana del capital final. No afecta los porcentajes de drawdown.',
    example: 'Ej: $10,000 = cuenta retail típica. $25,000 = mínimo para PDT en US. $100,000 = Prop Firm Funded.',
  },
  commission: {
    title: 'Comisión + Slippage (%)',
    body: 'Costo total que descuento a cada operación: comisión del broker + slippage de ejecución (diferencia entre precio ideal y real). Sumalos.',
    example: 'Ej: BTC Binance Futures = 0.04% maker + 0.02% slippage. Forex retail = 0.5%. Acciones IBKR = 0.005%.',
  },
  inputType: {
    title: 'Tipo de rendimiento',
    body: 'Cómo está expresado el PnL en tu CSV. "Auto" lo detecto leyendo la columna (símbolos %, $, magnitudes). Forzá manual si la detección falla.',
    example: 'Ej Percent: +2.5%, -1.8%. Ej Money: +$120, -$80, +1500 USD.',
  },
  iterations: {
    title: 'Iteraciones',
    body: 'Cantidad de trayectorias alternativas que simulo con Block Bootstrap. Más iteraciones = percentiles más precisos pero más tiempo de cálculo (en navegador).',
    example: 'Ej: 1,000 = rápido para iterar. 10,000 = estándar académico (recomendado). 50,000 = máxima precisión.',
  },
  pnlCol: {
    title: 'Columna de Rendimiento (PnL)',
    body: 'Obligatoria. La columna de tu CSV que tiene la ganancia o pérdida neta de cada operación cerrada.',
    example: 'Ej: "P&L %", "Net Profit", "PyG Netas %", "Rendimiento", "Profit/Loss". La auto-detecto pero podés cambiarla si me equivoco.',
  },
  typeCol: {
    title: 'Columna de Tipo de operación',
    body: 'Opcional. Si tu CSV mezcla filas de entradas + salidas + ajustes administrativos (swap/fee/funding/deposit), uso esta columna para filtrar solo las salidas reales. Si tu CSV ya viene limpio, dejala en "Ninguna".',
    example: 'Ej: TradingView exporta "Entrada larga / Salida larga / Salida corta" en columna Tipo — solo cuento las Salidas para no duplicar trades.',
  },
  dateCol: {
    title: 'Columna de Fecha',
    body: 'Opcional pero MUY recomendada. Detecto el rango temporal del backtest para anualizar el Sharpe Ratio correctamente. Sin fechas, asumo 1 año por defecto y el Sharpe puede salir sesgado.',
    example: 'Ej: "Fecha/Hora", "DateTime", "Timestamp", "Exit Date". Si tu CSV cubre 2 años el Sharpe se divide entre √2 — no es lo mismo que asumir 1 año.',
  },
} as const

const PHASE_BORDER: Record<PhaseStatus, string> = {
  check: 'border-emerald-500',
  warning: 'border-amber-500',
  danger: 'border-rose-500',
}
const PHASE_BADGE: Record<PhaseStatus, string> = {
  check: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-rose-500/10 text-rose-400',
}

export default function MonteCarloAuditor() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [data, setData] = useState<AuditData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [settings, setSettings] = useState<SimSettings>({
    initialCapital: 10000,
    commission: 0,
    iterations: 10000,
    inputType: 'auto',
    pnlCol: -1,
    typeCol: -1,
    dateCol: -1,
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runAnalysis = useCallback(
    (csv: ParsedCSV, cfg: SimSettings) => {
      try {
        setErrorMsg('')
        const { returnsRaw, years, isPercent } = extractReturns(csv, cfg)
        const result = runMonteCarloSim(returnsRaw, isPercent, years, cfg)
        setData(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setErrorMsg(msg)
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Re-correr análisis al cambiar settings (con debounce para inputs numéricos)
  useEffect(() => {
    if (!parsed) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      runAnalysis(parsed, settings)
    }, 80)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [parsed, settings, runAnalysis])

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!/\.csv$/i.test(file.name)) {
      window.alert('❌ Solo se aceptan archivos .csv')
      e.target.value = ''
      return
    }
    if (!ALLOWED_MIME.has(file.type)) {
      window.alert('❌ Tipo de archivo no permitido. Subí un CSV real.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_CSV_BYTES) {
      window.alert(`❌ El archivo supera ${MAX_CSV_BYTES / 1024 / 1024} MB. Recortá la planilla.`)
      e.target.value = ''
      return
    }
    if (file.size === 0) {
      window.alert('❌ El archivo está vacío.')
      e.target.value = ''
      return
    }

    const rawName = file.name.replace(/\.csv$/i, '')
    setStrategyName(sanitizeForExcel(rawName).slice(0, STRATEGY_NAME_MAX))
    setLoading(true)
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? '')
        const csv = parseCSV(text)
        setParsed(csv)
        setSettings((prev) => ({
          ...prev,
          pnlCol: csv.autoPnlCol,
          typeCol: csv.autoTypeCol,
          dateCol: csv.autoDateCol,
        }))
        // No corremos análisis acá: el useEffect lo hace cuando settings se actualiza
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setErrorMsg(msg)
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo.')
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const saveToSupabase = async () => {
    if (!data) return
    setSaving(true)
    setSaveStatus('')
    try {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        throw new Error('Debes iniciar sesión para guardar auditorías.')
      }

      const cleanName = sanitizeForExcel(strategyName || 'Estrategia de Trading').slice(
        0,
        STRATEGY_NAME_MAX,
      )

      // numeric(5,2) -> clampear a ±999.99
      const clampNumeric = (v: number) => clampNumber(v, -999.99, 999.99, 0)

      const { error } = await supabase.from('simulaciones_montecarlo').insert({
        user_id: userData.user.id,
        nombre_estrategia: cleanName,
        cantidad_trades: data.nTrades,
        winrate: parseFloat((data.winRate * 100).toFixed(2)),
        esperanza_matematica: parseFloat(clampNumeric(data.expectancy).toFixed(2)),
        sharpe_ratio: parseFloat(clampNumeric(data.sharpe).toFixed(2)),
        k_ratio: parseFloat(clampNumber(data.kRatio, -999.999, 999.999, 0).toFixed(3)),
        probabilidad_ruina: parseFloat(data.probRuin30.toFixed(2)),
        drawdown_95: parseFloat(data.dd95.toFixed(2)),
        veredicto: data.veredicto,
      })
      if (error) throw error

      const { error: cleanupError } = await supabase.rpc('cleanup_simulaciones_montecarlo')
      if (cleanupError) console.warn('[MonteCarlo] cleanup falló:', cleanupError.message)

      setSaveStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con Supabase'
      setSaveStatus(msg)
    } finally {
      setSaving(false)
    }
  }

  const downloadReport = async () => {
    if (!data) return
    const { jsPDF } = await import('jspdf')

    const logoDataUrl = await fetch('/logo-gon.png')
      .then((r) => (r.ok ? r.blob() : null))
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            if (!blob) return resolve(null)
            const reader = new FileReader()
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          }),
      )
      .catch(() => null)

    const estrategia = sanitizeForExcel(strategyName || 'Estrategia de Trading').slice(
      0,
      STRATEGY_NAME_MAX,
    )
    const fecha = new Date()

    const INK: [number, number, number] = [13, 17, 34]
    const CREAM: [number, number, number] = [240, 236, 228]
    const BONE: [number, number, number] = [229, 212, 182]
    const PULSE: [number, number, number] = [244, 78, 28]
    const MUTED: [number, number, number] = [80, 75, 65]

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 48
    const usableWidth = pageW - marginX * 2

    const drawBackground = () => {
      doc.setFillColor(...CREAM)
      doc.rect(0, 0, pageW, pageH, 'F')
    }

    const drawHeader = (sub: string) => {
      const headerH = 110
      doc.setFillColor(...INK)
      doc.rect(0, 0, pageW, headerH, 'F')
      doc.setFillColor(...PULSE)
      doc.rect(0, headerH - 3, pageW, 3, 'F')
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', marginX, 28, 40, 40) } catch { /* fallback */ }
      } else {
        doc.setFillColor(...PULSE)
        doc.circle(marginX + 12, 48, 8, 'F')
      }
      doc.setTextColor(...BONE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('GONOVI · INICIO', marginX + 56, 44)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      doc.text('PROYECTO MONTECARLO', marginX + 56, 66)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...BONE)
      doc.setFontSize(8)
      doc.text(sub, marginX + 56, 82)
      const fechaStr = fecha.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      doc.setFontSize(9)
      doc.text(fechaStr, pageW - marginX, 66, { align: 'right' })
      return headerH
    }

    const drawFooter = () => {
      doc.setDrawColor(...PULSE)
      doc.setLineWidth(1)
      doc.line(marginX, pageH - 52, pageW - marginX, pageH - 52)
      doc.setTextColor(...MUTED)
      doc.setFontSize(8)
      doc.text('Generado por GONOVI · Proyecto Montecarlo · gonovi.app/official/montecarlo', marginX, pageH - 36)
      doc.text('No constituye asesoría financiera. Resultados pasados no garantizan futuros.', marginX, pageH - 22)
    }

    // === Página 1: Veredicto + Métricas ===
    drawBackground()
    let y = drawHeader('Auditoría Estocástica · gonovi.app') + 40

    doc.setTextColor(...PULSE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('ESTRATEGIA AUDITADA', marginX, y)
    y += 20
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(estrategia, marginX, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(
      `${data.nTrades} operaciones · ${data.iterations.toLocaleString('es-AR')} simulaciones · Block Bootstrap · ${data.isPercent ? '% por trade' : '$ por trade'} · ventana ${data.years.toFixed(2)} años`,
      marginX,
      y,
    )

    y += 32
    const veredictoColor: [number, number, number] =
      data.veredicto === 'RESISTENCIA EXCELENTE' ? [16, 185, 129]
      : data.veredicto === 'RESISTENCIA MODERADA' ? [245, 158, 11]
      : data.veredicto === 'RIESGO ELEVADO' ? [234, 88, 12]
      : [239, 68, 68]
    doc.setFillColor(...veredictoColor)
    doc.rect(marginX, y, usableWidth, 50, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('VEREDICTO', marginX + 16, y + 18)
    doc.setFontSize(15)
    doc.text(data.veredicto, marginX + 16, y + 40)

    y += 84
    doc.setTextColor(...PULSE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('MÉTRICAS', marginX, y)
    y += 6

    const metricas: Array<[string, string]> = [
      ['Capital inicial', `$${data.initialCapital.toLocaleString('es-AR')}`],
      ['Mediana capital final', `$${Math.round(data.medianCap).toLocaleString('es-AR')}`],
      ['Win Rate', `${(data.winRate * 100).toFixed(2)}%`],
      ['Esperanza matemática', data.isPercent
        ? `${data.expectancy >= 0 ? '+' : ''}${data.expectancy.toFixed(2)}%`
        : `${data.expectancyCash >= 0 ? '+' : ''}$${data.expectancyCash.toFixed(2)} (${data.expectancy.toFixed(2)}%)`],
      ['Sharpe Ratio (anualizado)', data.sharpe.toFixed(2)],
      ['K-Ratio (log-curve)', data.kRatio.toFixed(3)],
      ['Frecuencia rentable', `${data.probProfit.toFixed(2)}%`],
      ['Frecuencia DD ≥ 20% (Prop Firm)', `${data.probRuin20.toFixed(2)}%`],
      ['Frecuencia DD ≥ 30% (Frontera Retail)', `${data.probRuin30.toFixed(2)}%`],
      ['Frecuencia DD ≥ 50% (Ruina clásica)', `${data.probRuin50.toFixed(2)}%`],
      ['Drawdown mediano (p50)', `${data.dd50.toFixed(2)}%`],
      ['Drawdown extremo (p95)', `${data.dd95.toFixed(2)}%`],
      ['Cisne negro (p99)', `${data.dd99.toFixed(2)}%`],
    ]

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    metricas.forEach(([label, value]) => {
      y += 20
      doc.setDrawColor(180, 175, 165)
      doc.setLineWidth(0.4)
      doc.line(marginX, y + 4, pageW - marginX, y + 4)
      doc.setTextColor(...MUTED)
      doc.text(label, marginX, y)
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.text(value, pageW - marginX, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
    })

    drawFooter()

    // === Página 2: Fases de auditoría + explicaciones ===
    doc.addPage()
    drawBackground()
    y = drawHeader('Fases de auditoría · 5 estudios estadísticos') + 32

    doc.setTextColor(...PULSE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('DETALLE INDIVIDUAL DE ESTUDIOS', marginX, y)
    y += 10

    data.phases.forEach((p, idx) => {
      y += 18
      const statusColor: [number, number, number] =
        p.status === 'check' ? [16, 185, 129]
        : p.status === 'warning' ? [245, 158, 11]
        : [239, 68, 68]

      doc.setFillColor(...statusColor)
      doc.rect(marginX, y - 9, 3, 14, 'F')
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(`Fase ${idx + 1}: ${p.name}`, marginX + 10, y)
      doc.setTextColor(...statusColor)
      doc.setFontSize(8)
      doc.text(p.statusText, pageW - marginX, y, { align: 'right' })

      y += 12
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const valWrap = doc.splitTextToSize(p.val, usableWidth - 10)
      doc.text(valWrap, marginX + 10, y)
      y += valWrap.length * 11

      doc.setTextColor(...MUTED)
      doc.setFontSize(8.5)
      const noteWrap = doc.splitTextToSize(p.note, usableWidth - 10)
      doc.text(noteWrap, marginX + 10, y)
      y += noteWrap.length * 10 + 4

      if (y > pageH - 120 && idx < data.phases.length - 1) {
        drawFooter()
        doc.addPage()
        drawBackground()
        y = drawHeader('Fases de auditoría · continuación') + 32
      }
    })

    y += 18
    if (y > pageH - 160) {
      drawFooter()
      doc.addPage()
      drawBackground()
      y = drawHeader('Cómo leer los percentiles') + 32
    }
    doc.setTextColor(...PULSE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('CÓMO LEER LOS PERCENTILES', marginX, y)

    const explicaciones: Array<[string, string]> = [
      [
        'Mediana (p50)',
        'El caso promedio de racha de pérdidas. La mitad de los traders sufrirán este drawdown o menos.',
      ],
      [
        'Extremo (p95)',
        'Tu límite de seguridad. Hay 95% de probabilidad de que tu peor drawdown nunca supere este valor. Solo 1 de cada 20 traders tendrá una secuencia tan mala que lo cruce.',
      ],
      [
        'Cisne Negro (p99)',
        'Escenario de mala suerte extrema: 1 entre 100 traders sufre algo así. Si este número te asusta, bajá el tamaño de posición.',
      ],
    ]
    explicaciones.forEach(([titulo, texto]) => {
      y += 16
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(titulo, marginX, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      const wrapped = doc.splitTextToSize(texto, usableWidth)
      doc.text(wrapped, marginX, y + 10)
      y += 10 + wrapped.length * 10
    })

    drawFooter()

    const safe = estrategia.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    doc.save(`montecarlo-${safe}-${fecha.getTime()}.pdf`)
  }

  const growthChartOptions = useMemo(
    () =>
      data
        ? {
            chart: {
              type: 'line' as const,
              height: 320,
              toolbar: { show: false },
              background: 'transparent',
              animations: { enabled: false },
            },
            theme: { mode: 'dark' as const },
            stroke: { width: 1.2, colors: ['#3b82f6'] },
            xaxis: {
              title: { text: 'Número de Operaciones', style: { color: '#9ca3af' } },
            },
            yaxis: {
              title: { text: 'Capital (USD)', style: { color: '#9ca3af' } },
              labels: {
                formatter: (v: number) => `$${Math.round(v).toLocaleString('es-ES')}`,
              },
            },
            legend: { show: false },
            grid: { borderColor: '#1e293b' },
            tooltip: { theme: 'dark' as const },
          }
        : {},
    [data],
  )

  const growthSeries = useMemo(
    () =>
      data
        ? data.samplePaths.map((path, idx) => ({
            name: `Simulación ${idx + 1}`,
            data: path,
          }))
        : [],
    [data],
  )

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <section className={shellStyles.appFrame} aria-label="Proyecto Montecarlo">
        <header className={shellStyles.topbar}>
          <div className={shellStyles.brand}>
            <span className={shellStyles.brandDot} aria-hidden="true" />
            GONOVI
            <span className={shellStyles.brandVersion}>INICIO</span>
          </div>
          <nav className={shellStyles.topnav} aria-label="Navegación principal">
            <Link href="/official" className={pathname === '/official' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official' ? 'page' : undefined}>Inicio</Link>
            <Link href="/official/montecarlo" className={pathname === '/official/montecarlo' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/montecarlo' ? 'page' : undefined}>Auditoría</Link>
            <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Resultados</Link>
            <Link href="/official/soporte" className={pathname === '/official/soporte' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>
          </nav>
          <div className={shellStyles.session}>
            <span>Auditoría estocástica · Demo</span>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6 text-slate-100" style={{ position: 'relative', zIndex: 2 }}>
          <Link
            href="/official"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#f44e1c',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              marginBottom: '1.5rem',
            }}
          >
            ← Volver a GONOVI
          </Link>

          <div className="text-center mb-8">
            <h1
              className="text-4xl font-extrabold"
              style={{
                fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
                background: 'linear-gradient(135deg, #f44e1c 0%, #f4a01c 50%, #e5d4b6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '0.02em',
              }}
            >
              PROYECTO MONTECARLO
            </h1>
            <p
              className="mt-2"
              style={{
                color: 'rgba(229, 212, 182, 0.7)',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                fontSize: '0.78rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Auditoría Estocástica · Block Bootstrap · Detección de Overfitting
            </p>
          </div>

          {/* Ajustes del stress-test */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                Capital inicial ($)
                <InfoTooltip {...TOOLTIPS.capital} align="left" />
              </label>
              <input
                type="number"
                min={1}
                max={MAX_CAPITAL}
                step={100}
                value={settings.initialCapital}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  initialCapital: clampNumber(parseFloat(e.target.value), 1, MAX_CAPITAL, 10000),
                }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                Comisión + slippage (%)
                <InfoTooltip {...TOOLTIPS.commission} align="right" />
              </label>
              <input
                type="number"
                min={0}
                max={MAX_COMMISSION_PCT}
                step={0.01}
                value={settings.commission}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  commission: clampNumber(parseFloat(e.target.value), 0, MAX_COMMISSION_PCT, 0),
                }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                Tipo de rendimiento
                <InfoTooltip {...TOOLTIPS.inputType} align="left" />
              </label>
              <select
                value={settings.inputType}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  inputType: e.target.value as SimSettings['inputType'],
                }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="auto">Autodetectar</option>
                <option value="percent">Porcentual (%)</option>
                <option value="money">Monetario ($)</option>
              </select>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                Iteraciones
                <InfoTooltip {...TOOLTIPS.iterations} align="right" />
              </label>
              <input
                type="number"
                min={MIN_ITERATIONS}
                max={MAX_ITERATIONS}
                step={500}
                value={settings.iterations}
                onChange={(e) => setSettings((s) => ({
                  ...s,
                  iterations: Math.round(clampNumber(parseFloat(e.target.value), MIN_ITERATIONS, MAX_ITERATIONS, 10000)),
                }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Selectores manuales de columnas dentro de acordeón "Avanzado" */}
          {parsed && (
            <details className="mb-6 bg-slate-900/40 border border-slate-800 rounded-xl group/det">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-300 hover:text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  ⚙️ Ajustes avanzados · Mapeo de columnas del CSV
                  <span className="text-[10px] font-normal text-slate-500 hidden sm:inline">
                    (auto-detectado · solo cambiar si la detección falla)
                  </span>
                </span>
                <span className="text-slate-500 text-xs transition-transform group-open/det:rotate-180">▼</span>
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                    Columna Rendimiento (PnL)
                    <InfoTooltip {...TOOLTIPS.pnlCol} align="left" />
                  </label>
                  <select
                    value={settings.pnlCol}
                    onChange={(e) => setSettings((s) => ({ ...s, pnlCol: parseInt(e.target.value, 10) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {parsed.headers.map((h, idx) => (
                      <option key={idx} value={idx}>{h.trim() || `Columna ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                    Columna Tipo (opcional)
                    <InfoTooltip {...TOOLTIPS.typeCol} align="center" />
                  </label>
                  <select
                    value={settings.typeCol}
                    onChange={(e) => setSettings((s) => ({ ...s, typeCol: parseInt(e.target.value, 10) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value={-1}>Ninguna (procesar todo)</option>
                    {parsed.headers.map((h, idx) => (
                      <option key={idx} value={idx}>{h.trim() || `Columna ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <label className="flex items-center text-xs text-slate-400 font-semibold mb-1">
                    Columna Fecha (opcional)
                    <InfoTooltip {...TOOLTIPS.dateCol} align="right" />
                  </label>
                  <select
                    value={settings.dateCol}
                    onChange={(e) => setSettings((s) => ({ ...s, dateCol: parseInt(e.target.value, 10) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value={-1}>Ninguna (sin fechas)</option>
                    {parsed.headers.map((h, idx) => (
                      <option key={idx} value={idx}>{h.trim() || `Columna ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 flex flex-col justify-center border-2 border-dashed border-slate-800 hover:border-blue-500 bg-slate-900/40 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Subir CSV de operaciones"
              />
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-300">Arrastra tu CSV de operaciones aquí</p>
              <p className="text-sm text-slate-500 mt-1">
                TradingView, MT4/MT5, o registros en formato CSV estándar
              </p>
              {parsed && (
                <p className="text-xs text-emerald-400 mt-3 font-mono">
                  ✓ {parsed.lines.length - 1} filas leídas · {parsed.headers.length} columnas
                </p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  Guardar Resultados
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  Guardamos hasta {MAX_STORED_AUDITS} auditorías por {RETENTION_DAYS} días.
                  El CSV nunca se sube — todo corre en tu navegador.
                </p>
                <input
                  type="text"
                  placeholder="Nombre de la estrategia"
                  value={strategyName}
                  maxLength={STRATEGY_NAME_MAX}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={saveToSupabase}
                disabled={!data || saving}
                type="button"
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-600 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar auditoría'}
              </button>

              <button
                onClick={downloadReport}
                disabled={!data}
                type="button"
                className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:bg-slate-900 disabled:text-slate-700 transition-colors"
              >
                Descargar reporte (.pdf)
              </button>

              {saveStatus === 'success' && (
                <p className="text-xs text-emerald-400 mt-2 text-center">✓ Guardado exitosamente.</p>
              )}
              {saveStatus && saveStatus !== 'success' && (
                <p className="text-xs text-rose-400 mt-2 text-center">⚠ {saveStatus}</p>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-950/40 border border-rose-800 rounded-xl p-4 mb-6 text-rose-200 text-sm">
              ⚠ {errorMsg}
            </div>
          )}

          {loading && (
            <div className="flex justify-center my-12">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
          )}

          {data && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Capital inicial</span>
                    <div className="text-2xl font-bold mt-1 text-slate-200">
                      ${data.initialCapital.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Mediana capital final</span>
                    <div className="text-2xl font-bold mt-1 text-blue-400">
                      ${Math.round(data.medianCap).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Frecuencia rentable</span>
                    <div className="text-2xl font-bold mt-1">{data.probProfit.toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Win Rate</span>
                    <div className="text-2xl font-bold mt-1">{(data.winRate * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-300">Detalle Individual de Estudios</h2>
                  {data.phases.map((p, idx) => (
                    <div
                      key={p.key}
                      className={`p-4 rounded-xl border-l-4 bg-slate-900/60 ${PHASE_BORDER[p.status]}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold flex items-center gap-2">
                          {p.emoji} Fase {idx + 1}: {p.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${PHASE_BADGE[p.status]}`}>
                          {p.statusText}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-200">{p.val}</p>
                      <p className="text-xs text-slate-400 mt-1">{p.note}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl text-center space-y-2">
                  {data.veredicto === 'RESISTENCIA EXCELENTE' && (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  )}
                  {(data.veredicto === 'RESISTENCIA MODERADA' || data.veredicto === 'RIESGO ELEVADO') && (
                    <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                  )}
                  {(data.veredicto === 'EXPECTATIVA NEGATIVA' || data.veredicto === 'RIESGO CRÍTICO') && (
                    <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  )}
                  <h3
                    className={`font-extrabold text-xl ${
                      data.veredicto === 'RESISTENCIA EXCELENTE' ? 'text-emerald-400'
                      : data.veredicto === 'RESISTENCIA MODERADA' ? 'text-amber-400'
                      : data.veredicto === 'RIESGO ELEVADO' ? 'text-orange-400'
                      : 'text-rose-400'
                    }`}
                  >
                    {data.veredictoTitle}
                  </h3>
                  <p className="text-sm text-slate-400">{data.veredictoText}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Caminos de Capital · Block Bootstrap (muestra de 30)
                  </h3>
                  <div className="w-full bg-slate-950 p-2 rounded-xl">
                    <Chart options={growthChartOptions} series={growthSeries} type="line" height={340} />
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-400" />
                    Estadísticas Clave del Peor Escenario
                  </h3>
                  <div className="space-y-5">
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm font-semibold">Mediana · Percentil 50%</span>
                        <span className="font-bold text-emerald-400 text-lg">{data.dd50.toFixed(2)}%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        El caso promedio de racha de pérdidas. La mitad de los traders sufrirán este drawdown o menos.
                      </p>
                    </div>
                    <div className="border-b border-slate-800 pb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm font-semibold">Extremo · Percentil 95%</span>
                        <span className="font-bold text-amber-500 text-lg">{data.dd95.toFixed(2)}%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Tu límite de seguridad. Hay 95% de probabilidad de que tu peor drawdown nunca supere este valor.
                        Solo 1 de cada 20 traders tendrá una secuencia tan mala que lo cruce.
                      </p>
                    </div>
                    <div className="pb-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300 text-sm font-semibold">Cisne Negro · Percentil 99%</span>
                        <span className="font-bold text-rose-500 text-lg">{data.dd99.toFixed(2)}%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Escenario de mala suerte extrema: 1 entre 100 traders sufre algo así. Si este número te asusta,
                        bajá el tamaño de posición.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-200 block mb-1">Sobre el cálculo:</strong>
                  Block Bootstrap muestrea bloques contiguos de operaciones (tamaño √n/2) preservando rachas reales,
                  mientras randomiza el orden. Más realista que bootstrap simple (que rompe la autocorrelación).
                  Sharpe anualizado con {data.years.toFixed(2)} años detectados del CSV. K-Ratio sobre log-curve.
                  PRNG Mersenne Twister (MT19937, semilla 42) — idéntico al de NumPy → resultados bit-a-bit
                  reproducibles entre web y Python. Percentiles con interpolación lineal NumPy-compatible.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
