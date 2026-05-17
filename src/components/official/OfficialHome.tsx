'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import styles from './official-home.module.css'
import { track } from '@/lib/client-analytics'

const MateriaLogo = dynamic(
  () => import('@/components/brand/MateriaLogo').then((mod) => mod.MateriaLogo),
  {
    ssr: false,
    loading: () => <div className={styles.logoFallback} aria-label="Cargando emblema GONOVI" />,
  }
)

const hubCards = [
  {
    num: '01', label: 'Módulo',
    title: 'Indicadores en vivo',
    text: 'Librería de señales AlgoTrend en tiempo real.',
    href: 'https://algotrend.gonovi.app',
    side: 'left' as const, external: true,
  },
  {
    num: '02', label: 'Simulador',
    title: 'Trading Lab',
    text: 'Escenarios de mercado con resultado en R.',
    href: '/official/lab',
    side: 'left' as const, external: false,
  },
  {
    num: '03', label: 'Análisis',
    title: 'Backtesting',
    text: 'Valida estrategias con datos históricos BTC 5M.',
    href: '/official/backtesting',
    side: 'left' as const, external: false,
  },
  {
    num: '04', label: 'Interactivo',
    title: 'Trading Interactivo',
    text: 'Retos gráficos y scoring sin login.',
    href: '/official/academia',
    side: 'right' as const, external: false,
  },
  {
    num: '05', label: 'Educación',
    title: 'Videos y Tutoriales',
    text: 'Análisis, setups y masterclasses en YouTube.',
    href: '/official/videos',
    side: 'right' as const, external: false,
  },
  {
    num: '06', label: 'Licencia',
    title: 'Obtener Script',
    text: 'Código fuente Pine Script completo, entrega inmediata.',
    href: '/official/checkout',
    side: 'right' as const, external: false,
  },
]

function HubCard({ card }: { card: typeof hubCards[number] }) {
  const handleClick = () => {
    track({ event_type: 'hub_card_click', card_id: card.num, card_title: card.title, path: '/official' })
  }

  const inner = (
    <>
      <span>{card.num} · {card.label}</span>
      <strong>{card.title}</strong>
      <p>{card.text}</p>
    </>
  )
  if (card.external) {
    return <a className={styles.heroNavCard} href={card.href} rel="noreferrer" target="_blank" onClick={handleClick}>{inner}</a>
  }
  return <Link className={styles.heroNavCard} href={card.href} onClick={handleClick}>{inner}</Link>
}

export default function OfficialHome() {
  const leftCards = hubCards.filter((c) => c.side === 'left')
  const rightCards = hubCards.filter((c) => c.side === 'right')

  /* ── Scroll refs ── */
  const containerRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [nyTime, setNyTime] = useState('')
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  /* Activa el estado scrolled al 25% del recorrido */
  useEffect(() => {
    return scrollYProgress.on('change', (v) => setScrolled(v > 0.25))
  }, [scrollYProgress])

  /* ── Logo: zoom + sale por la derecha (Framer Motion, sin recorte) ── */
  const logoScale = useTransform(scrollYProgress, [0, 1], [1, 1.55])
  const logoX = useTransform(scrollYProgress, [0, 1], ['0vw', '22vw'])

  /* ── Reloj NY en vivo ── */
  useEffect(() => {
    const tick = () => setNyTime(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date())
    )
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  /* ── BTC precio en vivo (Bitstamp) ── */
  useEffect(() => {
    const fetchBtc = () =>
      fetch('https://www.bitstamp.net/api/v2/ticker/btcusd/')
        .then((r) => r.json())
        .then((d) => {
          const pct = ((parseFloat(d.last) - parseFloat(d.open)) / parseFloat(d.open)) * 100
          setBtcChange({ pct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', up: pct >= 0 })
        })
        .catch(() => { /* silent */ })
    fetchBtc()
    const id = setInterval(fetchBtc, 30_000)
    return () => clearInterval(id)
  }, [])

  /* ── Analytics pageview ── */
  useEffect(() => {
    const key = 'gonovi:pv:official'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    track({ path: '/official', referrer: document.referrer || null })
  }, [])

  return (
    <main className={styles.shell} ref={containerRef}>
      <div className={styles.noise} />
      <div className={styles.shardOne} aria-hidden="true" />
      <div className={styles.shardTwo} aria-hidden="true" />
      <div className={styles.shardThree} aria-hidden="true" />

      <div className={styles.stickyFrame}>

        {/* ── Topbar ── */}
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandDot} aria-hidden="true" />
            GONOVI · ALGOTREND
            <span className={styles.brandVersion}>v4.2.1</span>
          </div>
          <nav className={styles.topnav} aria-label="Navegación principal">
            <span className={styles.topnavActive}>Hub</span>
            <span>Mercados</span>
            <span>Estrategias</span>
            <span>Soporte</span>
          </nav>
          <div className={styles.session}>
            <span className={styles.sessionLive}>
              <span className={styles.pulse} aria-label="Sesión activa" />
              Sesión activa
            </span>
            <span>NY · {nyTime || '––:––'}</span>
            <span className={styles.sessionId}>Trader · 0427</span>
          </div>
        </header>

        {/* ── Main Canvas ── */}
        <section className={styles.hero} aria-label="GONOVI AlgoTrend Hub">
          <div className={styles.heroGeometry} aria-hidden="true">
            <span className={styles.geoShapeOne} />
            <span className={styles.geoShapeTwo} />
            <span className={styles.geoShapeThree} />
            <span className={styles.geoShapeFour} />
          </div>

          {/* data-scrolled activa los CSS transforms de colapso */}
          <div
            className={styles.heroMasthead}
            data-scrolled={scrolled ? 'true' : 'false'}
          >

            {/* Columna izquierda — sube 60px al scrollear */}
            <nav className={styles.colLeft} aria-label="Herramientas izquierda">
              {leftCards.map((card) => <HubCard card={card} key={card.title} />)}
            </nav>

            {/* Logo 3D — zoom + sale por la derecha (Framer Motion) */}
            <motion.div
              className={styles.logoShell}
              style={{ scale: logoScale, x: logoX }}
            >
              <div className={styles.logoStage}>
                <div className={styles.logoHalo} aria-hidden="true" />
                <div className={styles.logoShardA} aria-hidden="true" />
                <div className={styles.logoShardB} aria-hidden="true" />
                <div className={styles.logoShardC} aria-hidden="true" />
                <MateriaLogo
                  amplitude={8}
                  autoRotateIdle={false}
                  baseColor={0x120d0a}
                  bloomIntensity={0.26}
                  cameraDistance={2800}
                  cursorTilt
                  enableZoom={false}
                  environmentIntensity={0.2}
                  gyroscope
                  heatColor={[0.98, 0.28, 0.08]}
                  heatEmissive={[1, 0.24, 0.02]}
                  heatEmissiveStrength={2.55}
                  heatTintStrength={1.36}
                  height="100%"
                  material={{ clearcoat: 0.34, clearcoatRoughness: 0.36, reflectivity: 0.08, roughness: 0.54 }}
                  preset="brasa"
                  svgUrl="/logo-gon-mark-3d.svg"
                  toneMappingExposure={0.84}
                  transparentBackground
                />
              </div>
            </motion.div>

            {/* Columna derecha — cruza a la izquierda y aterriza bajo tarjeta 3 */}
            <nav className={styles.colRight} aria-label="Herramientas derecha">
              {rightCards.map((card) => <HubCard card={card} key={card.title} />)}
            </nav>

          </div>
        </section>

        {/* ── Bottombar ── */}
        <footer className={styles.bottombar}>
          <div className={styles.ticker} aria-label="Precios de mercado">
            <div className={styles.tickerTrack} aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className={styles.tickerSet}>
                  <div className={styles.tickItem}><span className={styles.tickPair}>ES1!</span><span className={styles.tickUp}>+0.42%</span></div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>NQ1!</span><span className={styles.tickUp}>+0.71%</span></div>
                  <div className={styles.tickItem}>
                    <span className={styles.tickPair}>BTC</span>
                    {btcChange
                      ? <span className={btcChange.up ? styles.tickUp : styles.tickDown}>{btcChange.pct}</span>
                      : <span className={styles.tickMuted}>···</span>}
                  </div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>EURUSD</span><span className={styles.tickUp}>+0.08%</span></div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>XAU</span><span className={styles.tickDown}>−0.22%</span></div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>GC1!</span><span className={styles.tickUp}>+0.14%</span></div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>CL1!</span><span className={styles.tickDown}>−0.33%</span></div>
                  <div className={styles.tickItem}><span className={styles.tickPair}>DXY</span><span className={styles.tickDown}>−0.11%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.bottomVer}>
            <span>© GONOVI 2026</span>
            <span className={styles.bottomSecured}>SECURED · TLS 1.3</span>
          </div>
        </footer>

      </div>
    </main>
  )
}
