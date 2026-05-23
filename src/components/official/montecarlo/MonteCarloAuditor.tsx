'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
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

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

type Veredicto = 'EXTREMADAMENTE ROBUSTO' | 'RIESGO MODERADO' | 'RIESGO CRÍTICO'

type AuditData = {
  nTrades: number
  winRate: number
  expectancy: number
  sharpe: number
  kRatio: number
  probProfit: number
  probRuin: number
  dd50: number
  dd95: number
  dd99: number
  medianCap: number
  samplePaths: number[][]
  maxDrawdowns: number[]
  veredicto: Veredicto
}

const STRATEGY_NAME_MAX = 100
const MAX_CSV_BYTES = 5 * 1024 * 1024 // 5 MB

const getMean = (arr: number[]): number =>
  arr.reduce((a, b) => a + b, 0) / arr.length

const getStdDev = (arr: number[], mean: number): number => {
  const sumSq = arr.reduce((a, b) => a + (b - mean) ** 2, 0)
  return Math.sqrt(sumSq / (arr.length - 1))
}

const runLinearRegression = (
  curve: number[],
): { slope: number; stdErrSlope: number } => {
  const n = curve.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += curve[i]
    sumXY += i * curve[i]
    sumXX += i * i
  }
  const meanX = sumX / n
  const meanY = sumY / n
  const slope = (sumXY - n * meanX * meanY) / (sumXX - n * meanX * meanX)
  const intercept = meanY - slope * meanX

  let sumResidualsSq = 0
  let sumXDiffSq = 0
  for (let i = 0; i < n; i++) {
    const predY = slope * i + intercept
    sumResidualsSq += (curve[i] - predY) ** 2
    sumXDiffSq += (i - meanX) ** 2
  }
  const sErr = Math.sqrt(sumResidualsSq / (n - 2))
  const stdErrSlope = sErr / Math.sqrt(sumXDiffSq)

  return { slope, stdErrSlope }
}

const TYPE_CANDIDATES = ['tipo', 'type', 'action', 'acción', 'operacion', 'operación']
const PNL_CANDIDATES = [
  'pyg netas %', 'p&g netas %', 'pyg netas', 'p&g netas',
  'net profit %', 'net profit', 'p/l %', 'p&l %', 'p/l', 'p&l',
  'profit %', 'profit', 'ganancia %', 'ganancia', 'pnl %', 'pnl', 'gain', 'pct',
]

const findCols = (hdrs: string[]): { tC: number; pC: number } => {
  let tC = -1
  let pC = -1
  hdrs.forEach((h, idx) => {
    const hLower = h.toLowerCase().trim()
    if (tC === -1 && TYPE_CANDIDATES.includes(hLower)) tC = idx
    if (pC === -1 && PNL_CANDIDATES.includes(hLower)) pC = idx
  })
  if (tC === -1) {
    hdrs.forEach((h, idx) => {
      const hL = h.toLowerCase()
      if (hL.includes('tipo') || hL.includes('type')) tC = idx
    })
  }
  if (pC === -1) {
    hdrs.forEach((h, idx) => {
      const hL = h.toLowerCase()
      if (
        hL.includes('pyg') ||
        hL.includes('p&l') ||
        hL.includes('profit') ||
        hL.includes('net') ||
        hL.includes('pnl')
      ) {
        pC = idx
      }
    })
  }
  return { tC, pC }
}

const parseReturns = (text: string): number[] => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) throw new Error('El archivo CSV está vacío.')

  let delimiter = ','
  let headers = lines[0].split(',')
  let result = findCols(headers)
  if (result.pC === -1) {
    headers = lines[0].split(';')
    delimiter = ';'
    result = findCols(headers)
  }
  const typeCol = result.tC
  const pnlCol = result.pC === -1 && headers.length === 1 ? 0 : result.pC
  if (pnlCol === -1) {
    throw new Error('No se detectó columna de ganancia/PnL.')
  }

  const returns: number[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    if (cols.length <= pnlCol) continue
    if (typeCol !== -1 && cols.length > typeCol) {
      const action = cols[typeCol].toLowerCase().trim()
      if (!action.startsWith('salida') && !action.startsWith('exit')) continue
    }
    const valStr = cols[pnlCol]
      .replace('%', '')
      .replace('$', '')
      .replace(' ', '')
      .replace(',', '.')
      .trim()
    const val = parseFloat(valStr)
    if (!Number.isNaN(val)) returns.push(val)
  }
  if (returns.length === 0) {
    throw new Error('No hay operaciones de salida válidas.')
  }
  return returns
}

const runMonteCarloSim = (returns: number[]): AuditData => {
  const initialCapital = 10000
  const iterations = 10000
  const nTrades = returns.length

  const wins = returns.filter((r) => r > 0)
  const winRate = wins.length / nTrades
  const avgWin = wins.length > 0 ? getMean(wins) : 0
  const losses = returns.filter((r) => r < 0).map(Math.abs)
  const avgLoss = losses.length > 0 ? getMean(losses) : 0
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss

  const meanRet = getMean(returns)
  const stdRet = getStdDev(returns, meanRet)
  const sharpe = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(nTrades / 3.0) : 0

  let cap = initialCapital
  const origCurve: number[] = [cap]
  returns.forEach((r) => {
    cap = cap * (1 + r / 100)
    origCurve.push(cap)
  })
  const reg = runLinearRegression(origCurve)
  const kRatio =
    reg.stdErrSlope > 0 ? reg.slope / (reg.stdErrSlope * Math.sqrt(origCurve.length)) : 0

  const finalBalances: number[] = []
  const maxDrawdowns: number[] = []
  let ruinCount = 0
  const samplePaths: number[][] = []

  for (let i = 0; i < iterations; i++) {
    let simCap = initialCapital
    const simPath: number[] = [simCap]
    let peak = simCap
    let maxDD = 0

    for (let t = 0; t < nTrades; t++) {
      const randIndex = Math.floor(Math.random() * nTrades)
      simCap = simCap * (1 + returns[randIndex] / 100)
      simPath.push(simCap)
      if (simCap > peak) peak = simCap
      const dd = ((peak - simCap) / peak) * 100
      if (dd > maxDD) maxDD = dd
    }

    finalBalances.push(simCap)
    maxDrawdowns.push(maxDD)
    if (maxDD >= 50.0) ruinCount++
    if (i < 20) samplePaths.push(simPath)
  }

  maxDrawdowns.sort((a, b) => a - b)
  finalBalances.sort((a, b) => a - b)

  const dd50 = maxDrawdowns[Math.floor(iterations * 0.5)]
  const dd95 = maxDrawdowns[Math.floor(iterations * 0.95)]
  const dd99 = maxDrawdowns[Math.floor(iterations * 0.99)]
  const medianCap = finalBalances[Math.floor(iterations * 0.5)]
  const probProfit =
    (finalBalances.filter((b) => b > initialCapital).length / iterations) * 100
  const probRuin = (ruinCount / iterations) * 100

  let veredicto: Veredicto = 'RIESGO CRÍTICO'
  if (dd95 < 15.0) veredicto = 'EXTREMADAMENTE ROBUSTO'
  else if (dd95 < 30.0) veredicto = 'RIESGO MODERADO'

  return {
    nTrades,
    winRate,
    expectancy,
    sharpe,
    kRatio,
    probProfit,
    probRuin,
    dd50,
    dd95,
    dd99,
    medianCap,
    samplePaths,
    maxDrawdowns,
    veredicto,
  }
}

export default function MonteCarloAuditor() {
  const [loading, setLoading] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [data, setData] = useState<AuditData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_CSV_BYTES) {
      window.alert('❌ Error: el archivo supera 5 MB.')
      return
    }

    setStrategyName(file.name.replace(/\.csv$/i, '').slice(0, STRATEGY_NAME_MAX))
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? '')
        const returns = parseReturns(text)
        const result = runMonteCarloSim(returns)
        setData(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        window.alert('❌ Error: ' + msg)
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      window.alert('❌ Error: no se pudo leer el archivo.')
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

      const { error } = await supabase.from('simulaciones_montecarlo').insert({
        user_id: userData.user.id,
        nombre_estrategia: (strategyName || 'Estrategia de Trading').slice(0, STRATEGY_NAME_MAX),
        cantidad_trades: data.nTrades,
        winrate: parseFloat((data.winRate * 100).toFixed(2)),
        esperanza_matematica: parseFloat(data.expectancy.toFixed(2)),
        sharpe_ratio: parseFloat(data.sharpe.toFixed(2)),
        k_ratio: parseFloat(data.kRatio.toFixed(3)),
        probabilidad_ruina: parseFloat(data.probRuin.toFixed(2)),
        drawdown_95: parseFloat(data.dd95.toFixed(2)),
        veredicto: data.veredicto,
      })
      if (error) throw error
      setSaveStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con Supabase'
      setSaveStatus(msg)
    } finally {
      setSaving(false)
    }
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
    <div className="max-w-6xl mx-auto p-6 bg-slate-950 text-slate-100 min-h-screen rounded-2xl border border-slate-900 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
          PROYECTO MONTECARLO
        </h1>
        <p className="text-slate-400 mt-2">
          Auditoría Estocástica & Filtro de Overfitting en Tiempo Real
        </p>
      </div>

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
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Guardar Resultados
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Puedes archivar esta simulación de forma segura en tu base de datos de Supabase.
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar en Supabase'}
          </button>

          {saveStatus === 'success' && (
            <p className="text-xs text-emerald-400 mt-2 text-center">✓ Guardado exitosamente.</p>
          )}
          {saveStatus && saveStatus !== 'success' && (
            <p className="text-xs text-rose-400 mt-2 text-center">⚠ {saveStatus}</p>
          )}
        </div>
      </div>

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
                <span className="text-xs text-slate-500 uppercase font-semibold">Esperanza Matemática</span>
                <div className="text-2xl font-bold mt-1 text-emerald-400">
                  {data.expectancy >= 0 ? '+' : ''}
                  {data.expectancy.toFixed(2)}%
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-xs text-slate-500 uppercase font-semibold">Tasa de Aciertos</span>
                <div className="text-2xl font-bold mt-1">{(data.winRate * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-xs text-slate-500 uppercase font-semibold">Mediana Capital (10k iter)</span>
                <div className="text-2xl font-bold mt-1 text-blue-400">
                  ${Math.round(data.medianCap).toLocaleString('es-ES')}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-xs text-slate-500 uppercase font-semibold">Rentabilidad Montecarlo</span>
                <div className="text-2xl font-bold mt-1">{data.probProfit.toFixed(1)}%</div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-300">Detalle Individual de Estudios</h2>

              <div
                className={`p-4 rounded-xl border-l-4 ${
                  data.expectancy > 0.1
                    ? 'bg-slate-900/60 border-emerald-500'
                    : 'bg-slate-900/60 border-rose-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold flex items-center gap-2">🎯 Esperanza Matemática</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      data.expectancy > 0.1
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {data.expectancy > 0.1 ? 'SALUDABLE' : 'PELIGROSO'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Gana en promedio un {data.expectancy.toFixed(2)}% netos por cada trade.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.expectancy > 0.1
                    ? 'El sistema tiene una ventaja matemática clara y consistente.'
                    : 'El margen de ganancia es demasiado estrecho o negativo. Comisiones o deslizamiento real te arruinarán.'}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border-l-4 ${
                  data.sharpe >= 1.5
                    ? 'bg-slate-900/60 border-emerald-500'
                    : data.sharpe >= 1.0
                      ? 'bg-slate-900/60 border-amber-500'
                      : 'bg-slate-900/60 border-rose-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold flex items-center gap-2">⚖️ Sharpe Ratio (Retorno / Riesgo)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      data.sharpe >= 1.5
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : data.sharpe >= 1.0
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {data.sharpe >= 1.5 ? 'EXCELENTE' : data.sharpe >= 1.0 ? 'MODERADO' : 'INEFICIENTE'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Ratio de estrés de la cuenta: {data.sharpe.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.sharpe >= 1.5
                    ? 'Rendimientos estables con volatilidad muy baja.'
                    : 'Buen retorno, pero con oscilaciones considerables.'}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border-l-4 ${
                  data.kRatio >= 1.5
                    ? 'bg-slate-900/60 border-emerald-500'
                    : 'bg-slate-900/60 border-rose-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold flex items-center gap-2">📐 Consistencia (K-Ratio)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      data.kRatio >= 1.5
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {data.kRatio >= 1.5 ? 'EXCELENTE' : 'INESTABLE'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Consistencia de la curva: {data.kRatio.toFixed(3)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.kRatio >= 1.5
                    ? 'Crecimiento muy lineal y regular. No depende de golpes de suerte.'
                    : 'Curva inestable con periodos planos prolongados o saltos irregulares.'}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border-l-4 ${
                  data.probRuin === 0
                    ? 'bg-slate-900/60 border-emerald-500'
                    : 'bg-slate-900/60 border-rose-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold flex items-center gap-2">
                    🎲 Probabilidad de Ruina (Pérdida &gt; 50%)
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      data.probRuin === 0
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {data.probRuin === 0 ? 'SEGURO' : 'PELIGROSO'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Existe un {data.probRuin.toFixed(2)}% de probabilidad de perder la mitad de tu cuenta.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.probRuin === 0
                    ? 'En 10,000 simulaciones aleatorias, ningún camino tocó la zona de ruina.'
                    : 'Riesgo de quiebra presente en malas rachas. Se recomienda bajar apalancamiento.'}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border-l-4 ${
                  data.dd95 < 15.0
                    ? 'bg-slate-900/60 border-emerald-500'
                    : data.dd95 < 30.0
                      ? 'bg-slate-900/60 border-amber-500'
                      : 'bg-slate-900/60 border-rose-500'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold flex items-center gap-2">
                    📉 Peor Escenario Extremo (Drawdown 95%)
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      data.dd95 < 15.0
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : data.dd95 < 30.0
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {data.dd95 < 15.0 ? 'SALUDABLE' : 'ALTO RIESGO'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  Drawdown máximo esperado en mala racha: {data.dd95.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  El percentil 95% indica que el 95% de las veces tu peor racha NO superará este valor.
                  <strong>
                    {' '}
                    Si tu backtest reportaba un drawdown bajo (ej. 8%) pero el test de Monte Carlo da
                    alto (ej. &gt;25%), tu bot sufre de OVERFITTING CRÍTICO (memorizó el pasado y
                    fallará en vivo).
                  </strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl text-center space-y-2">
              {data.veredicto === 'EXTREMADAMENTE ROBUSTO' && (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="text-emerald-400 font-extrabold text-xl">
                    ✅ ESTRATEGIA EXTREMADAMENTE ROBUSTA
                  </h3>
                  <p className="text-sm text-slate-400">
                    El peor escenario esperado es completamente controlable. La ventaja matemática del
                    bot es real y duradera.
                  </p>
                </>
              )}
              {data.veredicto === 'RIESGO MODERADO' && (
                <>
                  <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                  <h3 className="text-amber-400 font-extrabold text-xl">
                    ⚠️ ESTRATEGIA SÓLIDA CON RIESGO MODERADO
                  </h3>
                  <p className="text-sm text-slate-400">
                    Es una estrategia viable pero requiere una gestión de riesgo y apalancamiento
                    conservadora en secuencias de mala suerte.
                  </p>
                </>
              )}
              {data.veredicto === 'RIESGO CRÍTICO' && (
                <>
                  <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h3 className="text-rose-400 font-extrabold text-xl">
                    ❌ ESTRATEGIA CON ALTO RIESGO / OVERFITTING
                  </h3>
                  <p className="text-sm text-slate-400">
                    Peligro severo de pérdida. El sistema tiene síntomas claros de sobreoptimización
                    al pasado (Backtest maquillado) y colapsará en vivo.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Caminos de Capital de Monte Carlo (Muestra de 20 simulaciones)
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
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400 text-sm">Mediana del Drawdown (Percentil 50%)</span>
                  <span className="font-bold text-emerald-400">{data.dd50.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400 text-sm">Drawdown Extremo (Percentil 95%)</span>
                  <span className="font-bold text-amber-500">{data.dd95.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-slate-400 text-sm">
                    Cisne Negro / Peor Racha Posible (Percentil 99%)
                  </span>
                  <span className="font-bold text-rose-500">{data.dd99.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
