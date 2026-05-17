'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import allScenarios, { type LabScenario, type LabCategory } from '@/data/official/trading-lab-scenarios'
import s from './trading-lab.module.css'

/* ─── constants ─── */
const ROUND_SIZE = 8
const STORAGE_ROUND = 'gonovi:trading-lab:round:v1'
const STORAGE_SEEN = 'gonovi:trading-lab:seen:v1'
const STORAGE_PROGRESS = 'gonovi:trading-lab:progress:v1'
const STORAGE_SCENARIO_COUNTS = 'gonovi_scenario_counts'

/* ─── types ─── */
type Decision = 'long' | 'short' | 'skip'
type RiskPct = 0.5 | 1 | 2
type TargetR = 1 | 2 | 3

interface AttemptResult {
  scenarioId: string
  scenarioTitle: string
  market: string
  timeframe: string
  category: LabCategory
  correctDecision: Decision
  decision: Decision
  correct: boolean
  rPnl: number
  accountPct: number
  mistakeTag: string
}

interface PersistedProgress {
  roundIds: string[]
  pos: number
  history: AttemptResult[]
  roundComplete: boolean
}

/* ─── shuffle (Fisher-Yates with crypto fallback) ─── */
function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0] / (0xffffffff + 1)
  }
  return Math.random()
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ─── round builder ─── */
function buildRound(
  pool: LabScenario[],
  size: number,
  seenIds: string[],
): string[] {
  const seenSet = new Set(seenIds)
  const unseen = pool.filter((sc) => !seenSet.has(sc.id))
  const source = unseen.length >= size ? unseen : pool
  const shuffled = shuffle(source)
  return shuffled.slice(0, Math.min(size, shuffled.length)).map((sc) => sc.id)
}

function sanitizeRoundIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const validIds = new Set(allScenarios.map((sc) => sc.id))
  return ids.filter((id): id is string => typeof id === 'string' && validIds.has(id))
}

function loadSeenIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_SEEN)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSeenIds(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_SEEN, JSON.stringify(ids))
  } catch { /* noop */ }
}

function loadRound(): string[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_ROUND)
    const ids = raw ? sanitizeRoundIds(JSON.parse(raw)) : []
    return ids.length ? ids : null
  } catch {
    return null
  }
}

function loadProgress(): PersistedProgress | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PROGRESS)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedProgress>
    const roundIds = sanitizeRoundIds(parsed.roundIds)
    if (!roundIds.length || parsed.roundComplete) return null
    const pos = typeof parsed.pos === 'number'
      ? Math.min(Math.max(Math.floor(parsed.pos), 0), roundIds.length - 1)
      : 0
    const history = Array.isArray(parsed.history) ? parsed.history : []
    return { roundIds, pos, history, roundComplete: false }
  } catch {
    return null
  }
}

function saveRound(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_ROUND, JSON.stringify(ids))
  } catch { /* noop */ }
}

function saveProgress(progress: PersistedProgress) {
  try {
    sessionStorage.setItem(STORAGE_PROGRESS, JSON.stringify(progress))
  } catch { /* noop */ }
}

function clearRound() {
  try {
    sessionStorage.removeItem(STORAGE_ROUND)
    sessionStorage.removeItem(STORAGE_PROGRESS)
  } catch { /* noop */ }
}

function trackScenarioAppearance(scenarioId: string | undefined) {
  if (!scenarioId) return

  try {
    const raw = window.localStorage.getItem(STORAGE_SCENARIO_COUNTS)
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    const current = typeof parsed[scenarioId] === 'number' ? parsed[scenarioId] : 0
    window.localStorage.setItem(STORAGE_SCENARIO_COUNTS, JSON.stringify({
      ...parsed,
      [scenarioId]: current + 1,
    }))
    window.dispatchEvent(new Event('gonovi_scenario_counts_updated'))
  } catch { /* local analytics only */ }
}

/* ─── helpers ─── */
function getAttemptResult({
  correctDecision, decision, maxResultR, risk, target,
}: {
  correctDecision: Decision; decision: Decision; maxResultR: number; risk: RiskPct; target: TargetR
}) {
  if (decision === 'skip') {
    return { correct: correctDecision === 'skip', rPnl: 0, accountPct: 0 }
  }
  const correct = decision === correctDecision
  const rPnl = correct ? Math.min(maxResultR, target) : -1
  return { correct, rPnl, accountPct: Number((rPnl * risk).toFixed(2)) }
}

function formatSigned(value: number, suffix = '') {
  if (value > 0) return `+${value}${suffix}`
  return `${value}${suffix}`
}

function decisionLabel(value: Decision) {
  if (value === 'long') return 'Largo'
  if (value === 'short') return 'Corto'
  return 'No operar'
}

function getMistakeTag(correctDecision: Decision, decision: Decision) {
  if (correctDecision === decision) return 'Lectura correcta'
  if (correctDecision === 'skip') return 'Sobreoperacion'
  if (decision === 'skip') return 'Exceso de cautela'
  if (correctDecision === 'long' && decision === 'short') return 'Sesgo bajista contra contexto'
  if (correctDecision === 'short' && decision === 'long') return 'Sesgo alcista contra contexto'
  return 'Lectura de direccion'
}

function getImprovementTip(tag: string) {
  const tips: Record<string, string> = {
    Sobreoperacion:
      'Estas entrando cuando el contexto no ofrece ventaja clara. Antes de decidir, valida volatilidad, rango y calidad del R:R.',
    'Exceso de cautela':
      'Estas dejando pasar setups validos. Enfocate en reconocer confirmaciones despues de barridas, reclaim o pullbacks limpios.',
    'Sesgo bajista contra contexto':
      'Tu lectura se inclino bajista aunque el mercado estaba recuperando zona o continuando estructura alcista.',
    'Sesgo alcista contra contexto':
      'Tu lectura se inclino alcista aunque el precio rechazaba oferta o perdia estructura relevante.',
    'Lectura de direccion':
      'Revisa primero estructura, zona y reaccion de la vela actual antes de elegir direccion.',
  }
  return tips[tag] ?? 'Revisa el contexto del escenario y compara tu decision contra la explicacion.'
}

const categoryLabels: Record<LabCategory, string> = {
  breakout: 'Rupturas',
  reversal: 'Reversiones',
  chop: 'Lateralidad',
  trend: 'Tendencia',
  risk: 'Gestion de riesgo',
  news: 'Noticias / ruido',
}

const categoryTips: Record<LabCategory, string> = {
  breakout: 'Practica confirmar si el quiebre es real o falso antes de entrar. Volumen y cierre son clave.',
  reversal: 'Busca confluencia: zona + patron + divergencia. Una sola señal no alcanza para reversar.',
  chop: 'Cuando no hay tendencia, la mejor operacion es no operar. Aprende a reconocer el rango.',
  trend: 'En tendencia, la paciencia paga. Espera pullbacks a zonas claras en vez de perseguir el impulso.',
  risk: 'Un setup correcto con mal R:R sigue siendo una mala entrada. Calcula antes de decidir.',
  news: 'Los primeros minutos post-noticia son ruido. Espera que el mercado digiera antes de entrar.',
}

function getRoundMessage(stats: { total: number; wins: number; wr: number }) {
  if (stats.total === 0) return 'Completa la ronda para recibir diagnostico.'
  if (stats.wins === stats.total) return 'Ronda perfecta. Repeti con una nueva seleccion aleatoria para validar que no fue memoria visual.'
  if (stats.wr >= 75) return 'Muy buena lectura general. Tu siguiente mejora esta en pulir los errores puntuales.'
  if (stats.wr >= 50) return 'Base interesante. Hay señales buenas, pero todavia aparecen sesgos repetidos que conviene aislar.'
  return 'Esta ronda muestra varias fugas de lectura. Perfecto para entrenar: ahora ya sabemos donde mirar.'
}

/* ─── mini SVG chart ─── */
function MiniChart({ scenario, revealed }: { scenario: LabScenario; revealed: boolean }) {
  const vw = 640
  const vh = 360
  const pad = 32
  const draw = revealed ? scenario.candles : scenario.candles.slice(0, scenario.revealFrom)
  const candleW = Math.min(36, (vw - pad * 2) / draw.length - 4)
  const gap = 4

  return (
    <svg className={s.chartSvg} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" aria-label={`Gráfico ${scenario.market} ${scenario.timeframe}`}>
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1={pad} x2={vw - pad} y1={vh - pad - ((y / 100) * (vh - pad * 2))} y2={vh - pad - ((y / 100) * (vh - pad * 2))} stroke="rgba(229,212,182,0.08)" strokeWidth={1} />
      ))}
      {scenario.levels.map((lv) => {
        const ly = vh - pad - (lv.y / 100) * (vh - pad * 2)
        const color = lv.kind === 'sl' ? '#F44E1C' : lv.kind === 'tp' ? '#4FBC72' : lv.kind === 'entry' ? '#FF8A60' : 'rgba(229,212,182,0.28)'
        const show = revealed || lv.kind === 'support' || lv.kind === 'resistance'
        if (!show) return null
        return (
          <g key={lv.label}>
            <line x1={pad} x2={vw - pad} y1={ly} y2={ly} stroke={color} strokeWidth={1} strokeDasharray="6 4" opacity={0.6} />
            <text x={vw - pad - 4} y={ly - 5} fill={color} fontSize={9} textAnchor="end" fontFamily="monospace">{lv.label}</text>
          </g>
        )
      })}
      {draw.map((c, i) => {
        const x = pad + i * (candleW + gap) + candleW / 2
        const [o, h, l, cl] = c
        const toY = (v: number) => vh - pad - (v / 100) * (vh - pad * 2)
        const bull = cl >= o
        const bodyTop = toY(Math.max(o, cl))
        const bodyBot = toY(Math.min(o, cl))
        const bodyH = Math.max(bodyBot - bodyTop, 1)
        const isFuture = i >= scenario.revealFrom
        const fillColor = bull ? '#4FBC72' : '#F44E1C'
        return (
          <g key={i} opacity={isFuture ? 0.85 : 1}>
            <line x1={x} x2={x} y1={toY(h)} y2={toY(l)} stroke={fillColor} strokeWidth={1.5} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx={3} fill={fillColor} />
          </g>
        )
      })}
      {!revealed && scenario.revealFrom < scenario.candles.length && (
        <rect x={pad + scenario.revealFrom * (candleW + gap) - gap / 2} y={0} width={vw} height={vh} fill="url(#curtain)" />
      )}
      <defs>
        <linearGradient id="curtain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(13,17,34,0)" />
          <stop offset="18%" stopColor="rgba(13,17,34,0.92)" />
          <stop offset="100%" stopColor="rgba(13,17,34,0.98)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ─── main component ─── */
export default function TradingLabPage() {
  const [roundIds, setRoundIds] = useState<string[]>([])
  const [pos, setPos] = useState(0)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [risk, setRisk] = useState<RiskPct>(1)
  const [target, setTarget] = useState<TargetR>(2)
  const [revealed, setRevealed] = useState(false)
  const [history, setHistory] = useState<AttemptResult[]>([])
  const [roundComplete, setRoundComplete] = useState(false)
  const [ready, setReady] = useState(false)

  /* init round from sessionStorage or create new */
  useEffect(() => {
    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) return

      const progress = loadProgress()
      if (progress) {
        setRoundIds(progress.roundIds)
        setPos(progress.pos)
        setHistory(progress.history)
        setRoundComplete(false)
        trackScenarioAppearance(progress.roundIds[progress.pos])
        setReady(true)
        return
      }

      const saved = loadRound()
      if (saved && saved.length > 0) {
        setRoundIds(saved)
        trackScenarioAppearance(saved[0])
      } else {
        const seen = loadSeenIds()
        const ids = buildRound(allScenarios, ROUND_SIZE, seen)
        setRoundIds(ids)
        saveRound(ids)
        trackScenarioAppearance(ids[0])
      }
      setReady(true)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!ready || !roundIds.length) return
    if (roundComplete) {
      clearRound()
      return
    }
    saveProgress({ roundIds, pos, history, roundComplete })
  }, [history, pos, ready, roundComplete, roundIds])

  const sc = useMemo(() => {
    if (!roundIds.length) return allScenarios[0]
    const id = roundIds[pos]
    return allScenarios.find((x) => x.id === id) ?? allScenarios[0]
  }, [roundIds, pos])

  const startNewRound = useCallback((pool?: LabScenario[]) => {
    const seen = loadSeenIds()
    const source = pool ?? allScenarios
    const ids = buildRound(source, ROUND_SIZE, seen)
    setRoundIds(ids)
    saveRound(ids)
    trackScenarioAppearance(ids[0])
    setPos(0)
    setDecision(null)
    setRevealed(false)
    setHistory([])
    setRoundComplete(false)
  }, [])

  const handleDecision = useCallback((d: Decision) => {
    setDecision(d)
    setRevealed(false)
  }, [])

  const handleReveal = useCallback(() => {
    if (!decision) return
    setRevealed(true)
    const result = getAttemptResult({
      correctDecision: sc.correctDecision, decision, maxResultR: sc.resultR, risk, target,
    })
    const attempt: AttemptResult = {
      scenarioId: sc.id, scenarioTitle: sc.title, market: sc.market,
      timeframe: sc.timeframe, category: sc.category,
      correctDecision: sc.correctDecision, decision,
      mistakeTag: getMistakeTag(sc.correctDecision, decision), ...result,
    }
    setHistory((prev) => [...prev, attempt])
    /* mark as seen */
    const seen = loadSeenIds()
    if (!seen.includes(sc.id)) {
      const next = [...seen, sc.id]
      if (next.length >= allScenarios.length) saveSeenIds([])
      else saveSeenIds(next)
    }
  }, [decision, sc, risk, target])

  const handleNext = useCallback(() => {
    if (pos >= roundIds.length - 1) {
      setRoundComplete(true)
      clearRound()
      return
    }
    trackScenarioAppearance(roundIds[pos + 1])
    setPos((p) => p + 1)
    setDecision(null)
    setRevealed(false)
  }, [pos, roundIds])

  const retryErrors = useCallback(() => {
    const weakIds = history.filter((h) => !h.correct).map((h) => h.scenarioId)
    if (!weakIds.length) { startNewRound(); return }
    const ids = shuffle(weakIds)
    setRoundIds(ids)
    saveRound(ids)
    trackScenarioAppearance(ids[0])
    setPos(0)
    setDecision(null)
    setRevealed(false)
    setHistory([])
    setRoundComplete(false)
  }, [history, startNewRound])

  const harderRound = useCallback(() => {
    const hard = allScenarios.filter((x) => x.difficulty !== 'inicial')
    startNewRound(hard)
  }, [startNewRound])

  /* stats */
  const stats = useMemo(() => {
    const total = history.length
    if (total === 0) return { total: 0, wins: 0, wr: 0, avgR: 0 }
    const wins = history.filter((h) => h.correct).length
    const wr = Math.round((wins / total) * 100)
    const avgR = +(history.reduce((a, h) => a + h.rPnl, 0) / total).toFixed(2)
    return { total, wins, wr, avgR }
  }, [history])

  /* category diagnosis */
  const categoryErrors = useMemo(() => {
    const wrong = history.filter((h) => !h.correct)
    const map = new Map<LabCategory, number>()
    wrong.forEach((h) => map.set(h.category, (map.get(h.category) ?? 0) + 1))
    return Array.from(map).sort((a, b) => b[1] - a[1])
  }, [history])

  const wrongAttempts = history.filter((h) => !h.correct)
  const mistakeSummary = Array.from(
    wrongAttempts.reduce((acc, item) => {
      acc.set(item.mistakeTag, (acc.get(item.mistakeTag) ?? 0) + 1)
      return acc
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1])

  const focusItems: Array<[string, number]> = mistakeSummary.length
    ? mistakeSummary.slice(0, 3)
    : [['Precision bajo presion', 0], ['Confirmacion de contexto', 0], ['Paciencia selectiva', 0]]

  const diffColor: Record<LabScenario['difficulty'], string> = {
    inicial: s.diffInicial, intermedio: s.diffIntermedio, avanzado: s.diffAvanzado,
  }

  const latestAttempt = history[history.length - 1]

  if (!ready) return null

  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <div className={s.shardOne} aria-hidden="true" />
      <div className={s.shardTwo} aria-hidden="true" />

      {/* header */}
      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← GONOVI</Link>
        <div className={s.headerCenter}>
          <span className={s.headerLabel}>GONOVI · TRADING LAB</span>
          <p className={s.headerSub}>Entrenamiento interactivo de lectura de mercado</p>
        </div>
        <div className={s.headerCounter}>
          {roundComplete ? roundIds.length : pos + 1} / {roundIds.length}
        </div>
      </header>

      {!roundComplete && (
        <>
          {/* scenario info */}
          <section className={s.scenarioBar}>
            <div className={s.scenarioMeta}>
              <span className={`${s.diffBadge} ${diffColor[sc.difficulty]}`}>{sc.difficulty}</span>
              <span className={s.marketBadge}>{sc.market} · {sc.timeframe}</span>
            </div>
            <h1 className={s.scenarioTitle}>{sc.title}</h1>
            <p className={s.scenarioContext}>{sc.context}</p>
          </section>

          {/* chart + panel */}
          <section className={s.workspace}>
            <div className={s.chartFrame}>
              <span className={s.chartTag}>{sc.market} {sc.timeframe} {revealed ? '· RESULTADO' : '· CONTEXTO'}</span>
              <MiniChart scenario={sc} revealed={revealed} />
              {!revealed && decision && (
                <div className={s.curtainLabel}>
                  <span>Futuro oculto</span>
                  <small>Revela para ver el resultado</small>
                </div>
              )}
            </div>
            <div className={s.controlPanel}>
              <div className={s.panelSection}>
                <span className={s.panelKicker}>Tu decision</span>
                <div className={s.choiceRow}>
                  <button type="button" className={`${s.choiceBtn} ${s.longBtn} ${decision === 'long' ? s.active : ''}`} onClick={() => handleDecision('long')} disabled={revealed}>▲ Largo</button>
                  <button type="button" className={`${s.choiceBtn} ${s.shortBtn} ${decision === 'short' ? s.active : ''}`} onClick={() => handleDecision('short')} disabled={revealed}>▼ Corto</button>
                  <button type="button" className={`${s.choiceBtn} ${s.skipBtn} ${decision === 'skip' ? s.active : ''}`} onClick={() => handleDecision('skip')} disabled={revealed}>— No operar</button>
                </div>
              </div>
              <div className={s.panelSection}>
                <span className={s.panelKicker}>Riesgo por operacion</span>
                <div className={s.optionRow}>
                  {([0.5, 1, 2] as RiskPct[]).map((r) => (
                    <button key={r} type="button" className={`${s.optionBtn} ${risk === r ? s.optionActive : ''}`} onClick={() => setRisk(r)} disabled={revealed}>{r}%</button>
                  ))}
                </div>
              </div>
              <div className={s.panelSection}>
                <span className={s.panelKicker}>Objetivo</span>
                <div className={s.optionRow}>
                  {([1, 2, 3] as TargetR[]).map((t) => (
                    <button key={t} type="button" className={`${s.optionBtn} ${target === t ? s.optionActive : ''}`} onClick={() => setTarget(t)} disabled={revealed}>{t}R</button>
                  ))}
                </div>
              </div>
              <div className={s.panelActions}>
                {!revealed ? (
                  <button type="button" className={s.revealBtn} onClick={handleReveal} disabled={!decision}>Revelar resultado</button>
                ) : (
                  <button type="button" className={s.nextBtn} onClick={handleNext}>
                    {pos >= roundIds.length - 1 ? 'Ver resumen de ronda →' : 'Siguiente escenario →'}
                  </button>
                )}
              </div>
              {revealed && (
                <div className={s.resultBox}>
                  <div className={s.resultHeader}>
                    <span className={decision === sc.correctDecision ? s.resultCorrect : s.resultWrong}>
                      {decision === sc.correctDecision ? '✓ Correcto' : '✗ Incorrecto'}
                    </span>
                    <span className={s.resultR}>{latestAttempt ? formatSigned(latestAttempt.rPnl, 'R') : '0R'}</span>
                  </div>
                  <p className={s.resultText}>{sc.explanation}</p>
                  <div className={s.resultMeta}>
                    <span>Respuesta correcta: <strong>{decisionLabel(sc.correctDecision)}</strong></span>
                    <span>Resultado: <strong>{sc.resultR > 0 ? `+${sc.resultR}R` : '0R'}</strong></span>
                    <span>Impacto teorico: <strong>{latestAttempt ? formatSigned(latestAttempt.accountPct, '%') : '0%'}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* round summary */}
      {roundComplete && (
        <section className={s.roundSummary}>
          <div className={s.summaryHeader}>
            <span className={s.panelKicker}>Resumen de ronda</span>
            <h2>{getRoundMessage(stats)}</h2>
            <p>
              Completaste {stats.total} escenarios con {stats.wins} aciertos, WR de {stats.wr}% y promedio de{' '}
              {formatSigned(stats.avgR, 'R')}. Este bloque convierte tus errores en una lista de practica concreta.
            </p>
          </div>

          {/* focus cards by mistake tag */}
          <div className={s.focusGrid}>
            {focusItems.map(([tag, count]) => (
              <article className={s.focusCard} key={tag}>
                <span>{count ? `${count} error${count === 1 ? '' : 'es'}` : 'sin errores'}</span>
                <strong>{tag}</strong>
                <p>{getImprovementTip(tag)}</p>
              </article>
            ))}
          </div>

          {/* category diagnosis */}
          {categoryErrors.length > 0 && (
            <div className={s.mistakeList}>
              <span className={s.panelKicker}>Diagnostico por categoria</span>
              {categoryErrors.map(([cat, count]) => (
                <article key={cat}>
                  <div>
                    <strong>{categoryLabels[cat]}</strong>
                    <span>{count} error{count === 1 ? '' : 'es'} · {categoryTips[cat]}</span>
                  </div>
                  <em>{cat}</em>
                </article>
              ))}
            </div>
          )}

          {/* wrong scenarios list */}
          {wrongAttempts.length > 0 ? (
            <div className={s.mistakeList}>
              <span className={s.panelKicker}>Escenarios para repasar</span>
              {wrongAttempts.map((item) => (
                <article key={item.scenarioId}>
                  <div>
                    <strong>{item.scenarioTitle}</strong>
                    <span>
                      {item.market} {item.timeframe} · elegiste {decisionLabel(item.decision)} · correcto era{' '}
                      {decisionLabel(item.correctDecision)}
                    </span>
                  </div>
                  <em>{item.mistakeTag}</em>
                </article>
              ))}
            </div>
          ) : (
            <div className={s.perfectBox}>
              <strong>No hubo errores en esta ronda.</strong>
              <p>
                Buen resultado. Para encontrar puntos de mejora, repetila subiendo el foco: menos impulsividad,
                mejor justificacion antes de revelar y atencion especial a escenarios de no operar.
              </p>
            </div>
          )}

          {/* 3 action buttons */}
          <div className={s.summaryActions}>
            <button type="button" className={s.revealBtn} onClick={() => startNewRound()}>
              Nueva ronda aleatoria
            </button>
            <button type="button" className={s.nextBtn} onClick={retryErrors}>
              Rehacer solo errores
            </button>
          </div>
          <div className={s.summaryActions} style={{ marginTop: '0.5rem' }}>
            <button type="button" className={s.nextBtn} onClick={harderRound}>
              Ronda mas dificil
            </button>
          </div>
        </section>
      )}

      {/* stats */}
      <section className={s.statsBar}>
        <div className={s.statItem}>
          <span className={s.statLabel}>Escenarios</span>
          <strong className={s.statValue}>{stats.total}</strong>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>Aciertos</span>
          <strong className={s.statValue}>{stats.wins}</strong>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>Win Rate</span>
          <strong className={s.statValue}>{stats.total > 0 ? `${stats.wr}%` : '—'}</strong>
        </div>
        <div className={s.statItem}>
          <span className={s.statLabel}>Promedio R</span>
          <strong className={`${s.statValue} ${stats.avgR > 0 ? s.statPositive : stats.avgR < 0 ? s.statNegative : ''}`}>
            {stats.total > 0 ? (stats.avgR > 0 ? `+${stats.avgR}` : stats.avgR) : '—'}
          </strong>
        </div>
      </section>

      {/* footer */}
      <footer className={s.footer}>
        <span>GONOVI · TRADING LAB</span>
        <Link href="/official">Volver al inicio</Link>
      </footer>
    </main>
  )
}
