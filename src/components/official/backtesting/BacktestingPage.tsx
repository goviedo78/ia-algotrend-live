'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Candle } from '@/lib/algotrend'
import s from './backtesting.module.css'
import { InfoTooltip } from '../InfoTooltip'

type Decision = 'long' | 'short' | 'skip'

const TIPS = {
  avanzar: {
    title: 'Avanzar velas',
    body: 'Hace que pase el tiempo: revelas las próximas 1, 5 o 15 velas para ver cómo se desarrolla el mercado ANTES de tomar tu decisión. Útil para analizar el contexto reciente sin spoilear el futuro lejano.',
    example: 'Ej: Avanzá 5 velas para ver si BTC viene rompiendo resistencia. Avanzá 15 si querés ver si se consolida un patrón. Cuando estés listo definí tu trade.',
  },
  decision: {
    title: 'Decisión: Long / Short / Skip',
    body: 'LONG = comprás esperando que el precio suba. SHORT = vendés (en corto) esperando que baje. SKIP = no operás esta vela (también es una decisión válida, evita malas operaciones forzadas).',
    example: 'Ej: si ves un setup débil sin confluencias, hacer SKIP es mejor que arriesgar. Los traders profesionales hacen SKIP en 60-70% de sus análisis.',
  },
  entradaBt: {
    title: 'Precio de entrada',
    body: 'A qué precio exacto querés abrir la operación. Podés entrar a precio de mercado (precio actual) o poner una orden limit a un nivel mejor (más bajo en long, más alto en short) y esperar que el precio toque.',
    example: 'Ej: precio actual $67,200. Entrada market = $67,200. Entrada limit a $67,000 = solo entrás si BTC pulla a ese soporte. Si no llega, no operás.',
  },
  stopBt: {
    title: 'Stop Loss',
    body: 'Precio donde se cierra automáticamente la operación si va en contra. Define tu PÉRDIDA MÁXIMA en este trade. Ponelo en una zona técnica (debajo de soporte en long, arriba de resistencia en short) — no en un número arbitrario.',
    example: 'Ej: LONG entrada $67k, soporte clave en $66,500 → Stop a $66,400 (apenas debajo). Si el soporte se rompe, salís. Si aguanta, la operación sigue viva.',
  },
  targetBt: {
    title: 'Take Profit (Target)',
    body: 'Precio donde se cierra automáticamente la operación si va a favor. Define tu GANANCIA OBJETIVO. Ponelo en una zona técnica de resistencia (long) o soporte (short) donde esperás que el precio reaccione.',
    example: 'Ej: LONG entrada $67k, Stop $66.5k (risk $500), resistencia en $68.5k → Target $68.5k. Risk/Reward = 1:3 (ganás 3 veces lo que arriesgás).',
  },
  precioActual: {
    title: 'Precio actual de la última vela visible',
    body: 'El cierre de la última vela que ves en el gráfico. Es tu "ahora" en la simulación. Las velas futuras están ocultas hasta que Avances o Reveles.',
    example: 'Ej: dice $67,234 → es donde cerró la última vela de 5 minutos. Las próximas todavía no las viste.',
  },
  riesgo: {
    title: 'Riesgo en dólares',
    body: 'Cuántos dólares por contrato/unidad arriesgás en este trade. Es la diferencia entre entrada y stop. NO es el riesgo total de tu cuenta — ese depende del tamaño de posición que decidas operar.',
    example: 'Ej: Entrada $67k, Stop $66.5k → Riesgo $500 por BTC. Si operás 0.1 BTC, tu pérdida máx = $50. Si operás 1 BTC, $500.',
  },
  revelar: {
    title: 'Revelar resultado',
    body: 'Hace correr la simulación: muestra las velas futuras y calcula si tu Stop o tu Target se tocó primero. El resultado se mide en R (múltiplos de riesgo): +1R = ganaste lo que arriesgaste, -1R = perdiste lo que arriesgaste.',
    example: 'Ej: TP a 3R, Stop a 1R. Si toca TP primero = +3R. Si toca Stop = -1R. Si no toca ninguno y se cierra la vela final, calcula contra precio de cierre (puede ser +0.5R, -0.3R, etc).',
  },
  escenarios: {
    title: 'Escenarios completados',
    body: 'Cantidad de sesiones de práctica que terminaste hasta ahora (no incluye la actual si no la revelaste). Más escenarios = más calibración de tu ojo clínico.',
    example: 'Ej: 50 escenarios = ya tenés base estadística personal. Compará tu Win Rate y R promedio con benchmarks pro (50% WR @ +0.5R, etc).',
  },
  aciertos: {
    title: 'Aciertos',
    body: 'De los escenarios que jugaste, en cuántos terminaste con R positivo (incluye los que cerraron en TP, en mid-trade positivo, etc). NO incluye skips ni stops.',
    example: 'Ej: 30 aciertos en 50 escenarios = 60% Win Rate. Pro traders manejan 40-65% WR con buen R:R.',
  },
  promedioR: {
    title: 'Promedio R por escenario',
    body: 'Tu resultado promedio en múltiplos de riesgo. Si es positivo, tu sistema gana plata en promedio. Si es negativo, perdés. Es la métrica más honesta de tu performance (independiente del tamaño de posición).',
    example: 'Ej: +0.4R = excelente (pro retail). +0.2R = decente. 0R = no ganás ni perdés. -0.2R o peor = mejorar antes de pasar a real.',
  },
} as const

const SESSION_SIZE = 160
const INITIAL_VISIBLE = 80

function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0] / (0xffffffff + 1)
  }
  return Math.random()
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value > 1000 ? 0 : 2,
    minimumFractionDigits: value > 1000 ? 0 : 2,
  })
}

function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(ts * 1000))
}

function pickWindow(candles: Candle[]): Candle[] {
  if (candles.length <= SESSION_SIZE) return candles
  const maxStart = Math.max(candles.length - SESSION_SIZE - 1, 0)
  const start = Math.floor(secureRandom() * maxStart)
  return candles.slice(start, start + SESSION_SIZE)
}

function resultClass(resultR: number | null, decision: Decision | null): string {
  if (decision === 'skip') return s.skip
  if (resultR !== null && resultR > 0) return s.correct
  return ''
}

function resultLabel(resultR: number | null, decision: Decision | null): string {
  if (decision === 'skip') return 'No operado'
  if (resultR === null) return 'Sin resultado'
  if (resultR >= 1) return 'Target alcanzado'
  if (resultR <= -1) return 'Stop tocado'
  return 'Cierre flotante'
}

const BacktestChart = memo(function BacktestChart({
  candles,
  visibleCount,
  entry,
  sl,
  tp,
}: {
  candles: Candle[]
  visibleCount: number
  entry: number | null
  sl: number | null
  tp: number | null
}) {
  const vw = 800
  const vh = 400
  const padX = 44
  const padY = 42
  const visibleCandles = candles.slice(0, visibleCount)

  if (!visibleCandles.length) return null

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  visibleCandles.forEach((candle) => {
    max = Math.max(max, candle.high)
    min = Math.min(min, candle.low)
  })

  if (entry !== null) { min = Math.min(min, entry); max = Math.max(max, entry) }
  if (sl !== null) { min = Math.min(min, sl); max = Math.max(max, sl) }
  if (tp !== null) { min = Math.min(min, tp); max = Math.max(max, tp) }

  const range = Math.max(max - min, 1)
  max += range * 0.1
  min -= range * 0.1

  const toY = (val: number) => vh - padY - ((val - min) / (max - min)) * (vh - padY * 2)
  const candleW = Math.max(3, Math.min(12, (vw - padX * 2) / Math.max(visibleCandles.length, 40) - 2))
  const stepX = (vw - padX * 2) / Math.max(visibleCandles.length - 1, 1)

  const line = (label: string, value: number, color: string) => (
    <g key={label}>
      <line x1={padX} x2={vw - padX} y1={toY(value)} y2={toY(value)} stroke={color} strokeDasharray="4 4" opacity={0.8} />
      <text x={vw - padX + 5} y={toY(value) + 4} fill={color} fontSize="10" fontFamily="monospace">{label}</text>
    </g>
  )

  return (
    <svg className={s.chartSvg} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
      {[0.2, 0.4, 0.6, 0.8].map((pct) => (
        <line
          key={pct}
          x1={padX}
          x2={vw - padX}
          y1={vh - padY - pct * (vh - padY * 2)}
          y2={vh - padY - pct * (vh - padY * 2)}
          stroke="rgba(229,212,182,0.06)"
          strokeWidth={1}
        />
      ))}

      {entry !== null && line('ENTRY', entry, '#FF8A60')}
      {sl !== null && line('SL', sl, '#F44E1C')}
      {tp !== null && line('TP', tp, '#4FBC72')}

      {visibleCandles.map((candle, i) => {
        const x = padX + i * stepX
        const bull = candle.close >= candle.open
        const bodyTop = toY(Math.max(candle.open, candle.close))
        const bodyBot = toY(Math.min(candle.open, candle.close))
        const bodyH = Math.max(bodyBot - bodyTop, 1)
        const fillColor = bull ? '#4FBC72' : '#F44E1C'

        return (
          <g key={`${candle.time}-${i}`}>
            <line x1={x} x2={x} y1={toY(candle.high)} y2={toY(candle.low)} stroke={fillColor} strokeWidth={1.4} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx={1.5} fill={fillColor} />
          </g>
        )
      })}
    </svg>
  )
})

export default function BacktestingPage() {
  const [allCandles, setAllCandles] = useState<Candle[]>([])
  const [sessionCandles, setSessionCandles] = useState<Candle[]>([])
  const [idx, setIdx] = useState(INITIAL_VISIBLE)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [entry, setEntry] = useState<number | null>(null)
  const [sl, setSl] = useState<number | null>(null)
  const [tp, setTp] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [resultR, setResultR] = useState<number | null>(null)
  const [resultText, setResultText] = useState('')
  const [stats, setStats] = useState({ total: 0, wins: 0, avgR: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentCandle = sessionCandles[Math.max(idx - 1, 0)]
  const currentClose = currentCandle?.close ?? null

  const progressLabel = useMemo(() => {
    if (!sessionCandles.length || !currentCandle) return 'CARGANDO'
    return `${idx} / ${sessionCandles.length} · ${formatDateTime(currentCandle.time)} UTC`
  }, [currentCandle, idx, sessionCandles.length])

  const resetTrade = useCallback(() => {
    setDecision(null)
    setEntry(null)
    setSl(null)
    setTp(null)
    setRevealed(false)
    setResultR(null)
    setResultText('')
  }, [])

  const startSession = useCallback((candles: Candle[]) => {
    const next = pickWindow(candles)
    setSessionCandles(next)
    setIdx(Math.min(INITIAL_VISIBLE, Math.max(next.length - 20, 1)))
    resetTrade()
  }, [resetTrade])

  useEffect(() => {
    let cancelled = false

    async function loadCandles() {
      setLoading(true)
      setError(null)

      try {
        const resp = await fetch('/api/public/candles/btc-5m', { cache: 'no-store' })
        const json = await resp.json() as { code?: number; data?: Candle[]; error?: string }

        if (!resp.ok || json.code === 1 || !json.data?.length) {
          throw new Error(json.error ?? 'No se pudieron cargar velas 5M')
        }

        if (cancelled) return
        const sorted = json.data.sort((a, b) => a.time - b.time)
        setAllCandles(sorted)
        startSession(sorted)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandles()

    return () => {
      cancelled = true
    }
  }, [startSession])

  const loadNew = useCallback(() => {
    if (!allCandles.length) return
    startSession(allCandles)
  }, [allCandles, startSession])

  const stepForward = useCallback((n: number) => {
    if (revealed || !sessionCandles.length) return
    setIdx((prev) => Math.min(prev + n, sessionCandles.length))
  }, [revealed, sessionCandles.length])

  const applyAutoPlan = useCallback((type: 'long' | 'short') => {
    if (!currentCandle) return

    setDecision(type)
    const close = currentCandle.close
    const lookback = sessionCandles.slice(Math.max(0, idx - 16), idx)
    const localLow = Math.min(...lookback.map((candle) => candle.low))
    const localHigh = Math.max(...lookback.map((candle) => candle.high))
    const buffer = Math.max(close * 0.00035, 10)

    if (type === 'long') {
      const stop = Math.min(localLow - buffer, close - buffer)
      const risk = Math.max(close - stop, close * 0.0005)
      setEntry(close)
      setSl(stop)
      setTp(close + risk * 2)
    } else {
      const stop = Math.max(localHigh + buffer, close + buffer)
      const risk = Math.max(stop - close, close * 0.0005)
      setEntry(close)
      setSl(stop)
      setTp(close - risk * 2)
    }
  }, [currentCandle, idx, sessionCandles])

  const revealFuture = useCallback(() => {
    if (revealed || !sessionCandles.length) return

    setRevealed(true)
    setIdx(sessionCandles.length)

    let rnl = 0
    let text = 'No operaste. Resultado neutro para esta practica.'

    if (decision && decision !== 'skip' && entry !== null && sl !== null && tp !== null) {
      const riskAmount = Math.abs(entry - sl)
      const targetR = Math.abs(tp - entry) / riskAmount
      const future = sessionCandles.slice(idx)
      let closed = false

      if (riskAmount <= 0 || !Number.isFinite(riskAmount)) {
        rnl = 0
        text = 'El stop debe estar separado de la entrada para calcular R.'
      } else {
        for (const candle of future) {
          if (decision === 'long') {
            if (candle.low <= sl) {
              rnl = -1
              text = `Stop tocado en ${formatDateTime(candle.time)} UTC.`
              closed = true
              break
            }
            if (candle.high >= tp) {
              rnl = targetR
              text = `Target alcanzado en ${formatDateTime(candle.time)} UTC.`
              closed = true
              break
            }
          } else {
            if (candle.high >= sl) {
              rnl = -1
              text = `Stop tocado en ${formatDateTime(candle.time)} UTC.`
              closed = true
              break
            }
            if (candle.low <= tp) {
              rnl = targetR
              text = `Target alcanzado en ${formatDateTime(candle.time)} UTC.`
              closed = true
              break
            }
          }
        }

        if (!closed) {
          const lastClose = future[future.length - 1]?.close ?? entry
          const diff = decision === 'long' ? lastClose - entry : entry - lastClose
          rnl = diff / riskAmount
          text = 'Ni stop ni target fueron tocados. Resultado calculado contra el ultimo cierre visible.'
        }
      }
    }

    setResultR(rnl)
    setResultText(text)
    setStats((prev) => {
      const isWin = rnl > 0
      const newTotal = prev.total + 1
      const newAvg = ((prev.avgR * prev.total) + rnl) / newTotal
      return { total: newTotal, wins: prev.wins + (isWin ? 1 : 0), avgR: newAvg }
    })
  }, [decision, entry, idx, revealed, sessionCandles, sl, tp])

  const canReveal = decision === 'skip' || (decision !== null && entry !== null && sl !== null && tp !== null)

  return (
    <main className={s.shell}>
      <div className={s.noise} />

      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← GONOVI</Link>
        <div className={s.headerCenter}>
          <span className={s.headerLabel}>BACKTESTING LIBRE</span>
          <p className={s.headerSub}>BTC 5M real · delay 24h · vela a vela</p>
        </div>
        <div style={{ width: '4rem' }} />
      </header>

      <section className={s.workspace}>
        <div className={s.chartFrame}>
          <div className={s.chartHeader}>
            <div>
              <div className={s.chartTag}>BTC/USD · 5M · BITSTAMP</div>
              <div className={s.chartSubtag}>{loading ? 'Cargando datos reales' : error ? 'Error de datos' : 'Sesion aleatoria con delay publico'}</div>
            </div>
            <div className={s.chartSubtag}>{progressLabel}</div>
          </div>

          {error ? (
            <div className={s.emptyState}>{error}</div>
          ) : (
            <BacktestChart candles={sessionCandles} visibleCount={idx} entry={entry} sl={sl} tp={tp} />
          )}

          <div className={s.chartControls}>
            <button type="button" className={s.chartBtn} onClick={() => stepForward(1)} disabled={loading || revealed || idx >= sessionCandles.length}>Avanzar 1</button>
            <button type="button" className={s.chartBtn} onClick={() => stepForward(5)} disabled={loading || revealed || idx >= sessionCandles.length}>Avanzar 5</button>
            <button type="button" className={s.chartBtn} onClick={() => stepForward(15)} disabled={loading || revealed || idx >= sessionCandles.length}>Avanzar 15</button>
          </div>
        </div>

        <div className={s.controlPanel}>
          <div className={s.panelSection}>
            <h1 className={s.scenarioTitle}>Practica real 5M</h1>
            <p className={s.scenarioContext}>
              Avanza vela por vela, define direccion, entrada, stop y target. El resultado se mide en R contra velas reales delayed.
            </p>
          </div>

          <div className={s.divider} />

          <div className={s.panelSection}>
            <span className={s.panelKicker}>
              Decision
              <InfoTooltip {...TIPS.decision} align="left" />
            </span>
            <div className={s.choiceRow}>
              <button type="button" className={`${s.choiceBtn} ${s.longBtn} ${decision === 'long' ? s.active : ''}`} onClick={() => applyAutoPlan('long')} disabled={loading || revealed}>
                ▲ Long
              </button>
              <button type="button" className={`${s.choiceBtn} ${s.shortBtn} ${decision === 'short' ? s.active : ''}`} onClick={() => applyAutoPlan('short')} disabled={loading || revealed}>
                ▼ Short
              </button>
              <button
                type="button"
                className={`${s.choiceBtn} ${s.skipBtn} ${decision === 'skip' ? s.active : ''}`}
                onClick={() => { setDecision('skip'); setEntry(null); setSl(null); setTp(null) }}
                disabled={loading || revealed}
              >
                — Skip
              </button>
            </div>
          </div>

          {decision && decision !== 'skip' && (
            <div className={s.panelSection}>
              <span className={s.panelKicker}>Entrada / Stop / Target</span>
              <div className={s.inputGrid}>
                <label>
                  <span>
                    Entrada
                    <InfoTooltip {...TIPS.entradaBt} align="left" />
                  </span>
                  <input type="number" value={entry ?? ''} onChange={(event) => setEntry(Number(event.target.value))} disabled={revealed} />
                </label>
                <label>
                  <span>
                    Stop
                    <InfoTooltip {...TIPS.stopBt} align="center" />
                  </span>
                  <input type="number" value={sl ?? ''} onChange={(event) => setSl(Number(event.target.value))} disabled={revealed} />
                </label>
                <label>
                  <span>
                    Target
                    <InfoTooltip {...TIPS.targetBt} align="right" />
                  </span>
                  <input type="number" value={tp ?? ''} onChange={(event) => setTp(Number(event.target.value))} disabled={revealed} />
                </label>
              </div>
              <div className={s.riskRow}>
                <div className={s.riskItem}>
                  <span className={s.riskLabel}>
                    Precio actual
                    <InfoTooltip {...TIPS.precioActual} align="left" />
                  </span>
                  <span className={s.riskValue}>${formatPrice(currentClose)}</span>
                </div>
                <div className={s.riskItem}>
                  <span className={s.riskLabel}>
                    Riesgo
                    <InfoTooltip {...TIPS.riesgo} align="right" />
                  </span>
                  <span className={s.riskValue}>${entry !== null && sl !== null ? formatPrice(Math.abs(entry - sl)) : '-'}</span>
                </div>
              </div>
            </div>
          )}

          {!revealed ? (
            <button type="button" className={s.revealBtn} onClick={revealFuture} disabled={loading || !canReveal}>
              Revelar resultado
            </button>
          ) : (
            <div className={`${s.resultBox} ${resultClass(resultR, decision)}`}>
              <div className={s.resultHeader}>
                <span className={s.resultStatus}>{resultLabel(resultR, decision)}</span>
                <span className={s.resultR}>{resultR !== null ? `${resultR > 0 ? '+' : ''}${resultR.toFixed(2)}R` : '0R'}</span>
              </div>
              <p className={s.resultText}>{resultText}</p>
              <button type="button" className={s.nextBtn} onClick={loadNew}>Nueva sesion real</button>
              <button type="button" className={s.nextBtn} style={{ marginTop: '0.4rem', opacity: 0.8 }} onClick={resetTrade}>Reintentar misma ventana</button>
            </div>
          )}
        </div>
      </section>

      <section className={s.statsBar}>
        <div className={s.statItem}>
          <span className={s.statLabel}>
            Escenarios
            <InfoTooltip {...TIPS.escenarios} align="left" />
          </span>
          <strong className={s.statValue}>{stats.total}</strong>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>
            Aciertos
            <InfoTooltip {...TIPS.aciertos} align="center" />
          </span>
          <strong className={s.statValue}>{stats.wins}</strong>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>
            Promedio R
            <InfoTooltip {...TIPS.promedioR} align="right" />
          </span>
          <strong className={`${s.statValue} ${stats.avgR > 0 ? s.statPositive : stats.avgR < 0 ? s.statNegative : ''}`}>
            {stats.total > 0 ? (stats.avgR > 0 ? `+${stats.avgR.toFixed(2)}` : stats.avgR.toFixed(2)) : '-'}
          </strong>
        </div>
      </section>

      <footer className={s.footer}>
        <span>GONOVI · BACKTESTING LIBRE · DATOS REALES DELAYED</span>
        <Link href="/official">Volver al inicio</Link>
      </footer>
    </main>
  )
}
