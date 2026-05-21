'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import shellStyles from '../official-home.module.css'
import styles from './mercados.module.css'

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

const cards = [
  {
    name: 'AlgoTrend BTC 1H',
    pair: 'BTC/USD · 1H',
    desc: 'Sistema direccional optimizado para Bitcoin, filtrando el ruido del marco menor.',
    url: 'https://algotrend.gonovi.app'
  },
  {
    name: 'Oro 15M',
    pair: 'XAU/USD · 15M',
    desc: 'Mesa de scalping ágil enfocada en las sesiones de liquidez de Londres y NY.',
    url: 'https://oro15.gonovi.app'
  },
  {
    name: 'Oro 30M',
    pair: 'XAU/USD · 30M',
    desc: 'Operativa de swing intradía en oro con menor exposición y alta probabilidad.',
    url: 'https://oro300.gonovi.app'
  }
]

export function MercadosPage() {
  const pathname = usePathname()
  const [nyTime, setNyTime] = useState('')
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)

  useEffect(() => {
    const tick = () => setNyTime(nyFormatter.format(new Date()))
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

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

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <section className={shellStyles.appFrame} aria-label="GONOVI Mercados">
        
        {/* APP SHELL HEADER */}
        <header className={shellStyles.topbar}>
          <div className={shellStyles.brand}>
            <span className={shellStyles.brandDot} aria-hidden="true" />
            GONOVI
            <span className={shellStyles.brandVersion}>HUB</span>
          </div>
          <nav className={shellStyles.topnav} aria-label="Navegación principal">
            <Link href="/official" className={pathname === '/official' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official' ? 'page' : undefined}>Hub</Link>
            <Link href="/official/mercados" className={pathname === '/official/mercados' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/mercados' ? 'page' : undefined}>Mercados</Link>
            <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Estrategias</Link>
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
            <h1 className={styles.title}>Indicadores en vivo</h1>
            <p className={styles.description}>El ecosistema GONOVI cubre BTC y Oro en distintos timeframes.</p>
          </div>
          <div className={styles.grid}>
            {cards.map(card => (
              <a key={card.name} href={card.url} target="_blank" rel="noreferrer" className={styles.card}>
                <div className={styles.cardGlow} aria-hidden="true" />
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <span className={styles.marketPair}>{card.pair}</span>
                    <span className={styles.badge}><span className={styles.dotLive}/> EN VIVO</span>
                  </div>
                  <h2 className={styles.cardTitle}>{card.name}</h2>
                  <p className={styles.cardDesc}>{card.desc}</p>
                </div>
              </a>
            ))}
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
