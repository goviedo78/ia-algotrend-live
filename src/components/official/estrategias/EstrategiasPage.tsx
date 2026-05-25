'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import shellStyles from '../official-home.module.css'
import styles from './estrategias.module.css'
import { InfoTooltip } from '../InfoTooltip'

import { createClient } from '@/lib/supabase/client'
import type { Trade } from '@/lib/db'

const TIPS = {
  trades: {
    title: 'Trades del mes',
    body: 'Cantidad total de operaciones que el algoritmo abrió este mes (cerradas + abiertas + skipped si las hubo). Incluye las que todavía no se cerraron.',
    example: 'Ej: 12 = el bot detectó 12 setups válidos y entró al mercado 12 veces en el mes.',
  },
  netoMes: {
    title: 'Rendimiento neto del mes',
    body: 'Cuánto creció (o cayó) tu cuenta este mes operando esta estrategia, asumiendo que reinvertís ganancias. Es interés compuesto, no la suma aritmética de cada trade.',
    example: 'Ej: 3 trades de +2%, +2%, +2% compuestos = +6.12% (no +6.00%). Si dice -5%, perdiste el 5% del capital del mes.',
  },
  cerradas: {
    title: 'Operaciones cerradas',
    body: 'Cuántos trades de este mes ya tocaron Stop Loss o Take Profit (es decir, ya tenés el resultado final). Las que faltan están todavía abiertas esperando salida.',
    example: 'Ej: "12 ops, 10 cerradas" → 10 ya dieron resultado, 2 siguen vivas en el mercado.',
  },
  winRate: {
    title: 'Win Rate global',
    body: 'De TODOS los trades cerrados (histórico completo, no solo este mes), qué porcentaje terminó en ganancia. Importante: un win rate alto no garantiza ganancias — depende del tamaño promedio de cada win vs cada loss.',
    example: 'Ej: 65% win rate con TP grande y SL chico = ganador. 80% win rate con TP chico y SL grande = puede ser perdedor.',
  },
  tradesTotales: {
    title: 'Trades totales',
    body: 'Cantidad acumulada de operaciones que el algoritmo ejecutó desde que se lanzó. Más trades = mayor significancia estadística (los resultados son menos atribuibles a suerte).',
    example: 'Ej: 50 trades = muestra chica, todavía hay incertidumbre. 200+ trades = muestra estadísticamente sólida.',
  },
  netoTotal: {
    title: 'Rendimiento neto total',
    body: 'Crecimiento acumulado de la cuenta desde el lanzamiento del algoritmo, asumiendo que reinvertís ganancias (interés compuesto). Es la métrica más realista de "cuánto ganó esta estrategia".',
    example: 'Ej: +42% desde lanzamiento → si arrancaste con $10k ahora tendrías $14,200 reinvertido. No es +42% sobre los $10k iniciales (eso sería simple).',
  },
  pnlFlotante: {
    title: 'PNL Flotante',
    body: 'Cuánto está ganando o perdiendo en TIEMPO REAL la operación abierta, calculado contra el precio actual del mercado. Cambia segundo a segundo y NO es resultado final hasta que la operación cierre.',
    example: 'Ej: LONG BTC entrada $67k, precio actual $68k → PNL flotante +1.5%. Si precio cae a $66k antes de cerrar, pasa a -1.5%.',
  },
  entrada: {
    title: 'Precio de entrada',
    body: 'Precio exacto al que el algoritmo abrió la posición. Este número no cambia: queda fijo hasta que cierre la operación.',
    example: 'Ej: Entrada $67,234 en BTC LONG = compraste BTC a $67,234. Ganás si sube, perdés si baja, hasta tocar Stop o Objetivo.',
  },
  stop: {
    title: 'Stop Loss (corte de pérdida)',
    body: 'Precio al que la operación se cierra automáticamente si el mercado va en tu contra, para limitar la pérdida máxima. Es tu cinturón de seguridad — define cuánto estás dispuesto a perder en este trade.',
    example: 'Ej: LONG entrada $67k, Stop $66k → si BTC cae a $66k, se cierra perdiendo $1k (~1.5%). No podés perder más.',
  },
  objetivo: {
    title: 'Take Profit (objetivo)',
    body: 'Precio al que la operación se cierra automáticamente si el mercado va a tu favor, para asegurar la ganancia. Define el objetivo de beneficio del trade.',
    example: 'Ej: LONG entrada $67k, Objetivo $70k → si BTC sube a $70k, se cierra ganando $3k (~4.5%). El ratio R:R es 3:1 (ganás 3x lo que arriesgás).',
  },
  longsShorts: {
    title: 'Longs vs Shorts',
    body: 'Cuántos trades del mes fueron al alza (LONG: comprás esperando que suba) vs a la baja (SHORT: vendés esperando que baje). El balance L/S indica si la estrategia favoreció una dirección.',
    example: 'Ej: "8L/4S" = 8 longs, 4 shorts. En mercado alcista normalmente predominan longs. 50/50 = estrategia neutra.',
  },
  winsLosses: {
    title: 'Ganadoras vs Perdedoras',
    body: 'Del mes, cuántas operaciones cerradas terminaron en ganancia vs en pérdida. NO suma a "Trades totales del mes" si hay operaciones todavía abiertas o sin resultado.',
    example: 'Ej: "8W/4L" = 8 ganadoras y 4 perdedoras este mes (Win Rate del mes = 66%). Si hay más abiertas no aparecen acá.',
  },
} as const

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

// Helper to format duration
function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}h ${remMins}m`
}

function formatPct(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatPrice(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function compoundPct(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === 'CLOSED' && t.pnl_pct !== null)
  if (closed.length === 0) return 0
  return (closed.reduce((acc, t) => acc * (1 + (t.pnl_pct ?? 0) / 100), 1) - 1) * 100
}

function groupTradesByMonth(trades: Trade[]) {
  const groups: Record<string, {
    total: number
    closed: number
    longs: number
    shorts: number
    wins: number
    losses: number
    netPct: number
    trades: Trade[]
  }> = {}
  
  for (const t of trades) {
    const date = new Date(t.open_time * 1000) // Unix timestamp in seconds
    const monthYear = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}|${monthYear}`
    
    if (!groups[key]) {
      groups[key] = { total: 0, closed: 0, longs: 0, shorts: 0, wins: 0, losses: 0, netPct: 0, trades: [] }
    }
    
    groups[key].total++
    if (t.direction === 'LONG') groups[key].longs++
    if (t.direction === 'SHORT') groups[key].shorts++
    if (t.status === 'CLOSED') {
      groups[key].closed++
      if ((t.pnl_pct ?? 0) > 0) groups[key].wins++
      if ((t.pnl_pct ?? 0) < 0) groups[key].losses++
    }
    groups[key].trades.push(t)
  }
  
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0])) // Descending by YYYY-MM
    .map(([key, data]) => {
      data.trades.sort((a, b) => b.open_time - a.open_time) // Descending inside month
      data.netPct = compoundPct(data.trades)
      return {
        label: key.split('|')[1].charAt(0).toUpperCase() + key.split('|')[1].slice(1), // Capitalize month
        ...data
      }
    })
}

interface StrategyData {
  all: Trade[]
  open: Trade | null
}

interface EstrategiasPageProps {
  initialData: {
    algotrend_trades: StrategyData
    gold15_trades: StrategyData
    gold30_trades: StrategyData
  }
}

export function EstrategiasPage({ initialData }: EstrategiasPageProps) {
  const pathname = usePathname()
  const [nyTime, setNyTime] = useState('')
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)

  const [dataBTC, setDataBTC] = useState<StrategyData>(initialData.algotrend_trades)
  const [dataOro15, setDataOro15] = useState<StrategyData>(initialData.gold15_trades)
  const [dataOro30, setDataOro30] = useState<StrategyData>(initialData.gold30_trades)
  const [now, setNow] = useState(0)
  const [btcPrice, setBtcPrice] = useState(0)
  const [goldPrice, setGoldPrice] = useState(0)
  const [goldSource, setGoldSource] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdate = (payload: any, setData: React.Dispatch<React.SetStateAction<StrategyData>>) => {
      const trade = payload.new as Trade
      setData(prev => {
        const isClosed = trade.status === 'CLOSED'
        const newAll = [...prev.all]
        
        const idx = newAll.findIndex(t => t.id === trade.id)
        if (idx >= 0) newAll[idx] = trade
        else newAll.unshift(trade)
        
        newAll.sort((a, b) => b.open_time - a.open_time)
        
        let newOpen = prev.open
        if (isClosed && prev.open?.id === trade.id) newOpen = null
        else if (!isClosed) newOpen = trade

        return { all: newAll, open: newOpen }
      })
    }

    const channel = supabase.channel('realtime-estrategias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'algotrend_trades' }, p => handleUpdate(p, setDataBTC))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold15_trades' }, p => handleUpdate(p, setDataOro15))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold30_trades' }, p => handleUpdate(p, setDataOro30))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNyTime(nyFormatter.format(new Date()))
    setNow(Date.now())

    const tick = () => {
      setNyTime(nyFormatter.format(new Date()))
      setNow(Date.now())
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetchPrices = () => {
      // BTC
      fetch('https://www.bitstamp.net/api/v2/ticker/btcusd/')
        .then((r) => r.json())
        .then((d) => {
          const current = parseFloat(d.last)
          const pct = ((current - parseFloat(d.open)) / parseFloat(d.open)) * 100
          setBtcChange({ pct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', up: pct >= 0 })
          setBtcPrice(current)
        })
        .catch(() => { /* silent */ })
      
      fetch('/api/market/gold')
        .then((r) => r.json())
        .then((d) => {
          if (d.code !== 0 || typeof d.price !== 'number') return
          setGoldPrice(d.price)
          setGoldSource(typeof d.source === 'string' ? d.source : '')
        })
        .catch(() => { /* silent */ })
    }
    
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

  const config = [
    {
      name: 'AlgoTrend BTC 1H',
      type: 'Swing Trading',
      pair: 'BTC/USD · 1H',
      currentPrice: btcPrice,
      priceSource: 'bitstamp',
      priceDigits: 2,
      data: dataBTC
    },
    {
      name: 'Oro 15M',
      type: 'Scalping',
      pair: 'XAU/USD · 15M',
      currentPrice: goldPrice,
      priceSource: goldSource,
      priceDigits: 3,
      data: dataOro15
    },
    {
      name: 'Oro 30M',
      type: 'Swing Intradía',
      pair: 'XAU/USD · 30M',
      currentPrice: goldPrice,
      priceSource: goldSource,
      priceDigits: 3,
      data: dataOro30
    }
  ]

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <section className={shellStyles.appFrame} aria-label="GONOVI Resultados">
        
        {/* APP SHELL HEADER */}
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
            <span className={shellStyles.sessionLive}>
              <span className={shellStyles.pulse} aria-label="Sesión activa" />
              Sesión activa
            </span>
            <span>NY · {nyTime || '––:––'}</span>
            <span className={shellStyles.sessionId}>Trader · 0427</span>
          </div>
        </header>

        {/* CONTENT */}
        <div className={styles.container}>
          <Link href="/official" className={styles.backLink}>← Volver a GONOVI</Link>
          <div>
            <h1 className={styles.title}>Resultados en vivo</h1>
            <p className={styles.description}>Rendimiento mensual de los indicadores activos de GONOVI. Solo mostramos dirección, operaciones, balance porcentual y estado de la operación abierta.</p>
          </div>
          
          <div className={styles.strategyList}>
            {config.map((strategy) => {
              const openT = strategy.data.open
              const months = groupTradesByMonth(strategy.data.all)

              let livePnlPct = openT?.pnl_pct ?? null
              if (livePnlPct === null && openT) {
                const mult = openT.direction === 'LONG' ? 1 : -1
                if (strategy.name.includes('BTC') && btcPrice > 0) {
                  livePnlPct = ((btcPrice - openT.open_price) / openT.open_price) * 100 * mult
                } else if (strategy.name.includes('Oro') && goldPrice > 0) {
                  livePnlPct = ((goldPrice - openT.open_price) / openT.open_price) * 100 * mult
                }
              }
              
              let glowClass = styles.openTradeGlowNeutral
              let badgeClass = styles.liveBadgeNeutral
              let dotClass = styles.pulseDotNeutral

              if (livePnlPct !== null) {
                if (livePnlPct >= 0) {
                  glowClass = styles.openTradeGlowPositive
                  badgeClass = styles.liveBadgePositive
                  dotClass = styles.pulseDotPositive
                } else {
                  glowClass = styles.openTradeGlowNegative
                  badgeClass = styles.liveBadgeNegative
                  dotClass = styles.pulseDotNegative
                }
              }
              
              let globalPnl = 0
              let winCount = 0
              let totalClosed = 0
              const closedTrades = strategy.data.all.filter((t) => t.status === 'CLOSED' && t.pnl_pct !== null)
              for (const t of strategy.data.all) {
                if (t.status === 'CLOSED' && t.pnl_pct !== null) {
                  totalClosed++
                  if (t.pnl_pct > 0) winCount++
                }
              }
              globalPnl = compoundPct(closedTrades)
              const winRate = totalClosed > 0 ? ((winCount / totalClosed) * 100).toFixed(1) : '0.0'
              const currentMonth = months.length > 0 ? months[0] : null
              
              return (
                <article key={strategy.name} className={styles.strategyPanel}>
                  <header className={styles.panelHeader}>
                    <div className={styles.panelTitleGroup}>
                      <span className={styles.badge}>{strategy.type}</span>
                      <h2 className={styles.panelTitle}>{strategy.name}</h2>
                      <span className={styles.marketPair}>{strategy.pair}</span>
                    </div>
                    
                    <div className={styles.headerStatsRow}>
                      {currentMonth && (
                        <div className={styles.statsBlock}>
                          <div className={styles.statsBlockTitle}>Mes en Curso ({currentMonth.label})</div>
                          <div className={styles.statsBlockData}>
                            <div className={styles.globalStatItem}>
                              <span className={styles.globalStatLabel}>
                                Trades
                                <InfoTooltip {...TIPS.trades} align="left" />
                              </span>
                              <span className={styles.globalStatValue}>{currentMonth.total}</span>
                            </div>
                            <div className={styles.globalStatItem}>
                              <span className={styles.globalStatLabel}>
                                Neto Mes
                                <InfoTooltip {...TIPS.netoMes} align="center" />
                              </span>
                              <span className={`${styles.globalStatValue} ${currentMonth.netPct >= 0 ? styles.tdPnlPositive : styles.tdPnlNegative}`}>
                                {formatPct(currentMonth.netPct)}
                              </span>
                            </div>
                            <div className={styles.globalStatItem}>
                              <span className={styles.globalStatLabel}>
                                Cerradas
                                <InfoTooltip {...TIPS.cerradas} align="right" />
                              </span>
                              <span className={styles.globalStatValue}>{currentMonth.closed}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className={styles.statsBlock}>
                        <div className={styles.statsBlockTitle}>Histórico Global</div>
                        <div className={styles.statsBlockData}>
                          <div className={styles.globalStatItem}>
                            <span className={styles.globalStatLabel}>
                              Win Rate
                              <InfoTooltip {...TIPS.winRate} align="left" />
                            </span>
                            <span className={styles.globalStatValue}>{winRate}%</span>
                          </div>
                          <div className={styles.globalStatItem}>
                            <span className={styles.globalStatLabel}>
                              Trades Totales
                              <InfoTooltip {...TIPS.tradesTotales} align="center" />
                            </span>
                            <span className={styles.globalStatValue}>{strategy.data.all.length}</span>
                          </div>
                          <div className={styles.globalStatItem}>
                            <span className={styles.globalStatLabel}>
                              Neto Total
                              <InfoTooltip {...TIPS.netoTotal} align="right" />
                            </span>
                            <span className={`${styles.globalStatValue} ${globalPnl >= 0 ? styles.tdPnlPositive : styles.tdPnlNegative}`}>
                              {globalPnl > 0 ? '+' : ''}{globalPnl.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </header>

                  <div className={styles.dashboardGrid}>
                    {/* Top Row: Open Trade */}
                    {openT ? (
                      <div className={styles.openTradeCard}>
                        <div className={`${styles.openTradeGlow} ${glowClass}`} aria-hidden="true" />
                        <div className={styles.openTradeHeader}>
                          <span className={`${styles.liveBadge} ${badgeClass}`}>
                            <span className={`${styles.pulseDot} ${dotClass}`} />
                            Operación abierta
                          </span>
                          <span className={styles.tradeDuration}>{formatDuration(now - openT.open_time * 1000)}</span>
                        </div>
                        <div className={styles.tradeDetails}>
                          <div>
                            <span className={openT.direction === 'LONG' ? styles.directionLong : styles.directionShort}>
                              {openT.direction}
                            </span>
                          </div>
                          <div className={styles.pnlFloating}>
                            <span className={styles.pnlLabel}>
                              PNL Flotante
                              <InfoTooltip {...TIPS.pnlFlotante} align="right" />
                            </span>
                            <span className={(livePnlPct || 0) >= 0 ? styles.pnlValuePositive : styles.pnlValueNegative}>
                              {livePnlPct !== null ? `${livePnlPct > 0 ? '+' : ''}${livePnlPct.toFixed(2)}%` : 'En curso...'}
                            </span>
                          </div>
                        </div>
                        <div className={styles.openTradeStats}>
                          <div>
                            <span>
                              Entrada
                              <InfoTooltip {...TIPS.entrada} align="left" />
                            </span>
                            <strong>{formatPrice(openT.open_price, strategy.priceDigits)}</strong>
                          </div>
                          <div>
                            <span>{strategy.priceSource === 'capital.com' ? 'CFD live' : 'Precio ref.'}</span>
                            <strong>{formatPrice(strategy.currentPrice || null, strategy.priceDigits)}</strong>
                          </div>
                          <div>
                            <span>
                              Stop
                              <InfoTooltip {...TIPS.stop} align="center" />
                            </span>
                            <strong>{formatPrice(openT.stop_loss, strategy.priceDigits)}</strong>
                          </div>
                          <div>
                            <span>
                              Objetivo
                              <InfoTooltip {...TIPS.objetivo} align="right" />
                            </span>
                            <strong>{formatPrice(openT.take_profit, strategy.priceDigits)}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.noTradeCard}>
                        <div className={styles.noTradeIcon}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                          </svg>
                        </div>
                        <div className={styles.noTradeText}>
                          <span className={styles.noTradeTitle}>ESCANEO DE MERCADO EN CURSO</span>
                          <span className={styles.noTradeSubtitle}>
                            Ninguna operación abierta en este momento. El algoritmo tiene registradas <strong>{strategy.data.all.length}</strong> operaciones históricas y se encuentra analizando liquidez a la espera del próximo setup.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Row: Monthly Accordion Wrapper */}
                    <div className={styles.historyWrapper}>
                      <details className={styles.masterDetails}>
                        <summary className={styles.masterSummary}>
                          <span className={styles.masterSummaryTitle}>Historial Mensual</span>
                          <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </summary>
                        <div className={styles.accordionContainer}>
                          {months.length > 0 ? months.map((m, i) => (
                            <details key={m.label} className={styles.details} open={i === 0}>
                              <summary className={styles.summary}>
                                <div className={styles.summaryContent}>
                                  <span className={styles.monthLabel}>{m.label}</span>
                                  <div className={styles.summaryStats}>
                                    <span>{m.total} Ops</span>
                                    <span>{m.longs}L/{m.shorts}S</span>
                                    <span>{m.wins}W/{m.losses}L</span>
                                    <span className={`${styles.tdPnl} ${m.netPct >= 0 ? styles.tdPnlPositive : styles.tdPnlNegative}`}>
                                      {formatPct(m.netPct)} Neto
                                    </span>
                                  </div>
                                </div>
                                <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                              </summary>
                              <div className={styles.detailsContent}>
                                <ul className={styles.tradeList}>
                                  {m.trades.map((t: Trade) => (
                                    <li key={t.id} className={styles.tradeItem}>
                                      <span className={t.direction === 'LONG' ? styles.directionLongSm : styles.directionShortSm}>
                                        {t.direction}
                                      </span>
                                      <div className={styles.tradeDates}>
                                        <span>
                                          IN: {new Date(t.open_time * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                          {' '}
                                          {new Date(t.open_time * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span>
                                          OUT: {t.close_time ? (
                                            <>
                                              {new Date(t.close_time * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                              {' '}
                                              {new Date(t.close_time * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            </>
                                          ) : '—'}
                                        </span>
                                      </div>
                                      <span className={(t.pnl_pct || 0) >= 0 ? styles.tdPnlPositive : styles.tdPnlNegative}>
                                        {t.pnl_pct !== null ? `${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%` : '-'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </details>
                          )) : (
                            <div className={styles.tableEmpty}>Aún no hay operaciones registradas.</div>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* APP SHELL FOOTER */}
        <footer className={shellStyles.bottombar}>
          <div className={shellStyles.ticker} aria-label="Precios de mercado">
            <div className={shellStyles.tickerTrack} aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className={shellStyles.tickerSet}>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>ES1!</span><span className={shellStyles.tickUp}>+0.42%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>NQ1!</span><span className={shellStyles.tickUp}>+0.71%</span></div>
                  <div className={shellStyles.tickItem}>
                    <span className={shellStyles.tickPair}>BTC</span>
                    {btcChange
                      ? <span className={btcChange.up ? shellStyles.tickUp : shellStyles.tickDown}>{btcChange.pct}</span>
                      : <span className={shellStyles.tickMuted}>···</span>}
                  </div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>EURUSD</span><span className={shellStyles.tickUp}>+0.08%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>XAU</span><span className={shellStyles.tickDown}>−0.22%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>GC1!</span><span className={shellStyles.tickUp}>+0.14%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>CL1!</span><span className={shellStyles.tickDown}>−0.33%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>DXY</span><span className={shellStyles.tickDown}>−0.11%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className={shellStyles.bottomVer}>
            <span>© GONOVI 2026</span>
            <span className={shellStyles.bottomSecured}>SECURED · TLS 1.3</span>
          </div>
        </footer>
      </section>
    </main>
  )
}
