'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import s from './academia.module.css'

type Decision = 'long' | 'short' | 'skip'
type Candle = [number, number, number, number]

type Challenge = {
  id: string
  module: string
  market: string
  timeframe: string
  title: string
  context: string
  prompt: string
  candles: Candle[]
  revealFrom: number
  answer: Decision
  lesson: string
  focus: string
}

const STORAGE_KEY = 'gonovi:academia:score:v1'

type ScoreState = { done: number; correct: number; xp: number; streak: number }

function readStoredScore(): ScoreState {
  const fallback = { done: 0, correct: 0, xp: 0, streak: 0 }
  if (typeof window === 'undefined') return fallback

  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return fallback

  try {
    return JSON.parse(saved) as ScoreState
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return fallback
  }
}

const challenges: Challenge[] = [
  {
    id: 'academy-liquidity-reclaim',
    module: 'Liquidez',
    market: 'NQ',
    timeframe: '5M',
    title: 'Barrida y recuperacion',
    context: 'Apertura con ruptura falsa del minimo previo. La vela cierra nuevamente dentro del rango y deja mecha inferior amplia.',
    prompt: '¿Que decision tiene mejor lectura si el siguiente cierre confirma encima del rango?',
    candles: [[58, 61, 55, 56], [56, 59, 53, 58], [58, 60, 57, 59], [59, 61, 58, 60], [60, 62, 40, 59], [59, 67, 58, 66], [66, 72, 64, 70], [70, 73, 68, 72]],
    revealFrom: 5,
    answer: 'long',
    lesson: 'La barrida que recupera rango no confirma debilidad; suele ser absorcion de liquidez antes del desplazamiento alcista.',
    focus: 'Esperar recuperacion, no vender la mecha.',
  },
  {
    id: 'academy-compression-break',
    module: 'Estructura',
    market: 'BTC',
    timeframe: '15M',
    title: 'Compresion antes de ruptura',
    context: 'Rango estrecho, minimos ascendentes y resistencia testeada varias veces. Todavia no hay cierre claro fuera de rango.',
    prompt: 'Antes del cierre de ruptura, ¿que decision reduce mejor el error?',
    candles: [[42, 46, 41, 45], [45, 46, 43, 44], [44, 47, 43, 46], [46, 47, 45, 46], [46, 48, 45, 47], [47, 48, 46, 47], [47, 57, 46, 55], [55, 62, 53, 60]],
    revealFrom: 6,
    answer: 'skip',
    lesson: 'La compresion es contexto, no entrada. Entrar antes del cierre convierte una lectura correcta en ejecucion prematura.',
    focus: 'Separar contexto de gatillo.',
  },
  {
    id: 'academy-trend-pullback',
    module: 'Tendencia',
    market: 'XAU',
    timeframe: '5M',
    title: 'Pullback a zona viva',
    context: 'Tendencia alcista limpia. El precio vuelve al ultimo impulso y rechaza la zona con cuerpos pequenos.',
    prompt: '¿Cual es el plan con mejor relacion riesgo/contexto?',
    candles: [[35, 43, 34, 42], [42, 51, 41, 49], [49, 57, 47, 55], [55, 56, 50, 52], [52, 53, 47, 49], [49, 52, 46, 51], [51, 61, 50, 59], [59, 70, 58, 68]],
    revealFrom: 6,
    answer: 'long',
    lesson: 'En tendencia, el pullback ordenado hacia zona previa permite entrar con stop tecnico pequeno y continuidad favorable.',
    focus: 'Comprar retroceso, no perseguir extension.',
  },
  {
    id: 'academy-chop-filter',
    module: 'Filtro',
    market: 'ETH',
    timeframe: '5M',
    title: 'Chop sin ventaja',
    context: 'Velas pequeñas, mechas a ambos lados, niveles rotos y recuperados sin desplazamiento. No hay secuencia direccional.',
    prompt: '¿Que decision protege mejor tu curva?',
    candles: [[50, 54, 47, 52], [52, 55, 49, 50], [50, 53, 46, 51], [51, 55, 48, 49], [49, 54, 47, 52], [52, 56, 49, 50], [50, 55, 47, 51], [51, 54, 48, 50]],
    revealFrom: 5,
    answer: 'skip',
    lesson: 'No operar tambien es una decision. En chop, la ventaja suele estar en esperar que aparezca desplazamiento real.',
    focus: 'Evitar sobreoperar ruido.',
  },
]

function drawPath(candles: Candle[], revealFrom: number, revealed: boolean) {
  const visible = revealed ? candles : candles.slice(0, revealFrom)
  const min = Math.min(...candles.flatMap(([, high, low]) => [high, low]))
  const max = Math.max(...candles.flatMap(([, high, low]) => [high, low]))
  const range = Math.max(max - min, 1)
  const xStep = 520 / Math.max(candles.length - 1, 1)
  const toY = (value: number) => 210 - ((value - min) / range) * 160

  return { visible, xStep, toY }
}

function decisionLabel(decision: Decision) {
  if (decision === 'long') return 'Largo'
  if (decision === 'short') return 'Corto'
  return 'No operar'
}

export default function AcademiaPage() {
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState<Decision | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState<ScoreState>(readStoredScore)

  const challenge = challenges[idx]
  const chart = useMemo(() => drawPath(challenge.candles, challenge.revealFrom, revealed), [challenge, revealed])
  const isCorrect = choice === challenge.answer

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(score))
  }, [score])

  function reveal() {
    if (!choice || revealed) return
    setRevealed(true)
    setScore((prev) => {
      const nextStreak = isCorrect ? prev.streak + 1 : 0
      return {
        done: prev.done + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        xp: prev.xp + (isCorrect ? 120 + nextStreak * 10 : 35),
        streak: nextStreak,
      }
    })
  }

  function nextChallenge() {
    setIdx((prev) => (prev + 1) % challenges.length)
    setChoice(null)
    setRevealed(false)
  }

  function resetScore() {
    const clean = { done: 0, correct: 0, xp: 0, streak: 0 }
    setScore(clean)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  }

  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← GONOVI</Link>
        <div>
          <span>TRADING INTERACTIVO</span>
          <p>Retos graficos · lectura de contexto · progreso inmediato</p>
        </div>
        <Link href="/official/backtesting" className={s.headerAction}>Backtesting 5M</Link>
      </header>

      <section className={s.hero}>
        <div className={s.copy}>
          <p className={s.kicker}>Entrenamiento por lectura</p>
          <h1>Aprender mercado resolviendo decisiones concretas.</h1>
          <p>
            Cada reto oculta el futuro. Elegis largo, corto o no operar; luego el sistema revela el desarrollo,
            actualiza tu score y deja una correccion accionable.
          </p>
        </div>
        <div className={s.scoreCard}>
          <span>Progreso de practica</span>
          <strong>{score.xp} XP</strong>
          <div className={s.scoreGrid}>
            <div><b>{score.done}</b><small>Retos</small></div>
            <div><b>{score.done ? Math.round((score.correct / score.done) * 100) : 0}%</b><small>WR</small></div>
            <div><b>{score.streak}</b><small>Racha</small></div>
          </div>
          <button type="button" onClick={resetScore}>Reiniciar progreso</button>
        </div>
      </section>

      <section className={s.workspace}>
        <article className={s.chartPanel}>
          <div className={s.chartHeader}>
            <div>
              <span>{challenge.market} · {challenge.timeframe} · {challenge.module}</span>
              <h2>{challenge.title}</h2>
            </div>
            <small>{revealed ? 'Futuro revelado' : 'Futuro oculto'}</small>
          </div>

          <svg className={s.chart} viewBox="0 0 620 260" role="img" aria-label={`Reto ${challenge.title}`}>
            {[0, 1, 2, 3].map((line) => (
              <line key={line} x1="42" x2="578" y1={52 + line * 42} y2={52 + line * 42} stroke="rgba(229,212,182,.07)" />
            ))}
            {chart.visible.map((candle, i) => {
              const x = 50 + i * chart.xStep
              const [open, high, low, close] = candle
              const bull = close >= open
              const color = bull ? '#4fbc72' : '#f44e1c'
              const yTop = chart.toY(Math.max(open, close))
              const yBottom = chart.toY(Math.min(open, close))
              return (
                <g key={`${challenge.id}-${i}`}>
                  <line x1={x} x2={x} y1={chart.toY(high)} y2={chart.toY(low)} stroke={color} strokeWidth="2" />
                  <rect x={x - 9} y={yTop} width="18" height={Math.max(yBottom - yTop, 2)} rx="3" fill={color} />
                </g>
              )
            })}
            {!revealed && (
              <rect x={50 + challenge.revealFrom * chart.xStep - 16} y="24" width="210" height="202" rx="18" fill="rgba(13,17,34,.82)" stroke="rgba(244,78,28,.2)" />
            )}
          </svg>
        </article>

        <aside className={s.panel}>
          <span className={s.kicker}>Reto {idx + 1} / {challenges.length}</span>
          <h2>{challenge.prompt}</h2>
          <p>{challenge.context}</p>
          <div className={s.choices}>
            {(['long', 'short', 'skip'] as Decision[]).map((decision) => (
              <button
                type="button"
                className={choice === decision ? s.active : ''}
                disabled={revealed}
                key={decision}
                onClick={() => setChoice(decision)}
              >
                {decisionLabel(decision)}
              </button>
            ))}
          </div>

          {!revealed ? (
            <button type="button" className={s.primary} disabled={!choice} onClick={reveal}>
              Revelar correccion
            </button>
          ) : (
            <div className={`${s.result} ${isCorrect ? s.good : s.bad}`}>
              <strong>{isCorrect ? 'Correcto' : 'Ajustar lectura'}</strong>
              <p>Respuesta esperada: {decisionLabel(challenge.answer)}. {challenge.lesson}</p>
              <small>{challenge.focus}</small>
              <button type="button" className={s.primary} onClick={nextChallenge}>Siguiente reto</button>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}
