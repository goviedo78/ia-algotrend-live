'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import styles from './official-home.module.css'
import { track } from '@/lib/client-analytics'

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

const MateriaLogo = dynamic(
  () => import('@/components/brand/MateriaLogo').then((mod) => mod.MateriaLogo),
  {
    ssr: false,
    loading: () => <div className={styles.materiaFallback} aria-hidden="true" />,
  }
)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type NotificationState = 'default' | 'granted' | 'denied' | 'unsupported'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

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

const HubCard = memo(function HubCard({ card }: { card: typeof hubCards[number] }) {
  const handleClick = useCallback(() => {
    track({ event_type: 'hub_card_click', card_id: card.num, card_title: card.title, path: '/official' })
  }, [card.num, card.title])

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
})

export default function OfficialHome() {
  const pathname = usePathname()
  const materiaRef = useRef<HTMLDivElement>(null)
  const [nyTime, setNyTime] = useState('')
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [notificationState, setNotificationState] = useState<NotificationState>('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const materiaRepelX = useMotionValue(0)
  const materiaRepelY = useMotionValue(0)
  const materiaX = useSpring(materiaRepelX, { stiffness: 86, damping: 18, mass: 0.65 })
  const materiaY = useSpring(materiaRepelY, { stiffness: 86, damping: 18, mass: 0.65 })

  const resetMateriaRepel = useCallback(() => {
    materiaRepelX.set(0)
    materiaRepelY.set(0)
  }, [materiaRepelX, materiaRepelY])

  const handleMateriaRepel = useCallback((event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion) return

    const materia = materiaRef.current
    if (!materia) return

    const bounds = materia.getBoundingClientRect()
    const materiaCenterX = bounds.left + bounds.width * 0.52
    const materiaCenterY = bounds.top + bounds.height * 0.5
    const deltaX = materiaCenterX - event.clientX
    const deltaY = materiaCenterY - event.clientY
    const distance = Math.hypot(deltaX, deltaY) || 1
    const isCoarsePointer = event.pointerType !== 'mouse' || window.matchMedia('(pointer: coarse)').matches
    const maxDistance = isCoarsePointer ? 340 : 520

    if (distance > maxDistance) {
      resetMateriaRepel()
      return
    }

    const proximity = 1 - distance / maxDistance
    const force = proximity * proximity * (3 - 2 * proximity)
    const maxPush = isCoarsePointer ? 34 : 78

    materiaRepelX.set((deltaX / distance) * maxPush * force)
    materiaRepelY.set((deltaY / distance) * maxPush * force * 0.82)
  }, [materiaRepelX, materiaRepelY, prefersReducedMotion, resetMateriaRepel])

  const handleInstall = useCallback(async () => {
    if (installed) return

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (!deferredPrompt && isIOS) {
      window.alert('Para instalar:\n\n1. Toca Compartir en Safari\n2. Elige "Agregar a pantalla de inicio"\n3. Confirma con "Agregar"')
      return
    }

    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }, [deferredPrompt, installed])

  const handleNotifications = useCallback(async () => {
    if (notificationState === 'unsupported' || notificationState === 'denied') return

    setNotificationLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setNotificationState(permission as NotificationState)
      if (permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()

      if (existingSubscription) {
        setNotificationsEnabled(true)
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setNotificationsEnabled(true)
        return
      }

      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        userVisibleOnly: true,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      setNotificationsEnabled(true)
    } catch (error) {
      console.error('[official notifications]', error)
    } finally {
      setNotificationLoading(false)
    }
  }, [notificationState])

  const handleShare = useCallback(async () => {
    const url = 'https://gonovi.app'
    const text = 'GONOVI · Trading algorítmico, indicadores, laboratorio y educación interactiva.'

    track({ event_type: 'share', method: typeof navigator.share === 'function' ? 'native' : 'clipboard', path: '/official' })

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'GONOVI', text, url })
        return
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2200)
    } catch {
      window.prompt('Copia este link:', url)
    }
  }, [])

  /* ── Reloj NY en vivo (formatter cacheado al nivel de módulo) ── */
  useEffect(() => {
    const tick = () => setNyTime(nyFormatter.format(new Date()))
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  /* ── PWA install prompt ── */
  /* eslint-disable react-hooks/set-state-in-effect -- Browser API sync: display-mode and install prompt are only available client-side */
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ── Push notification status ── */
  /* eslint-disable react-hooks/set-state-in-effect -- Browser API sync: Notification/SW capability must be checked client-side */
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationState('unsupported')
      return
    }

    setNotificationState(Notification.permission as NotificationState)
    navigator.serviceWorker.ready
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription()
        setNotificationsEnabled(Boolean(subscription))
      })
      .catch(() => setNotificationState('unsupported'))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <main
      className={styles.shell}
      onPointerCancel={resetMateriaRepel}
      onPointerDown={handleMateriaRepel}
      onPointerLeave={resetMateriaRepel}
      onPointerMove={handleMateriaRepel}
    >
      <div className={styles.noise} />
      <div className={styles.shardOne} aria-hidden="true" />
      <div className={styles.shardTwo} aria-hidden="true" />
      <div className={styles.shardThree} aria-hidden="true" />

      <section className={styles.appFrame} aria-label="GONOVI Hub">
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandDot} aria-hidden="true" />
            GONOVI
            <span className={styles.brandVersion}>HUB</span>
          </div>
          <nav className={styles.topnav} aria-label="Navegación principal">
            <Link href="/official" className={pathname === '/official' ? styles.topnavActive : ''} aria-current={pathname === '/official' ? 'page' : undefined}>Hub</Link>
            <Link href="/official/mercados" className={pathname === '/official/mercados' ? styles.topnavActive : ''} aria-current={pathname === '/official/mercados' ? 'page' : undefined}>Mercados</Link>
            <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? styles.topnavActive : ''} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Estrategias</Link>
            <Link href="/official/soporte" className={pathname === '/official/soporte' ? styles.topnavActive : ''} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>
          </nav>
          <div className={styles.session}>
            <span className={styles.sessionLive}>
              <span className={styles.pulse} aria-label="Sesión activa" />
              Sesión activa
            </span>
            <span>NY · {nyTime || '––:––'}</span>
            <span className={styles.sessionId}>Trader · 0427</span>
          </div>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen}
            aria-controls="topnav-mobile-drawer"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {menuOpen
                ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
            </svg>
          </button>
        </header>

        {menuOpen && (
          <div
            className={styles.menuOverlay}
            onClick={() => setMenuOpen(false)}
            role="presentation"
          >
            <nav
              id="topnav-mobile-drawer"
              className={styles.menuPanel}
              onClick={(e) => e.stopPropagation()}
              aria-label="Navegación principal móvil"
            >
              <Link href="/official" className={pathname === '/official' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official' ? 'page' : undefined}>Hub</Link>
              <Link href="/official/mercados" className={pathname === '/official/mercados' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/mercados' ? 'page' : undefined}>Mercados</Link>
              <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Estrategias</Link>
              <Link href="/official/soporte" className={pathname === '/official/soporte' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>
            </nav>
          </div>
        )}

        <section className={styles.appCanvas}>
          <div className={styles.heroGeometry} aria-hidden="true">
            <span className={styles.geoShapeOne} />
            <span className={styles.geoShapeTwo} />
            <span className={styles.geoShapeThree} />
            <span className={styles.geoShapeFour} />
          </div>

          <div className={styles.profileCard}>
            <div className={styles.profileMark}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-gon-mark-3d.svg"
                alt="GONOVI mark"
                width={72}
                height={72}
                style={{
                  filter: 'brightness(0) invert(1) drop-shadow(0 0 14px rgba(244,78,28,.55)) drop-shadow(0 0 28px rgba(244,78,28,.25)) drop-shadow(0 2px 6px rgba(0,0,0,.45))',
                }}
              />
            </div>
            <div className={styles.profileContent}>
              <span className={styles.profileEyebrow}>GONOVI · HUB</span>
              <h1>Trading algorítmico BTC 1H</h1>
              <p>Indicadores · Lab · Educación</p>
            </div>
            <Link className={styles.profileAction} href="/official/lab">
              Probar demo gratis →
            </Link>
          </div>

          <div className={styles.quickActions} aria-label="Acciones rápidas">
            <button
              className={styles.quickAction}
              data-mobile-label="App"
              disabled={installed || (!deferredPrompt && typeof navigator !== 'undefined' && !/iPad|iPhone|iPod/.test(navigator.userAgent))}
              onClick={handleInstall}
              type="button"
            >
              <span className={styles.quickIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg>
              </span>
              <span className={styles.quickLabel}>{installed ? 'App instalada' : 'Instalar app'}</span>
            </button>
            <button
              className={`${styles.quickAction} ${notificationsEnabled ? styles.quickActionActive : ''}`}
              data-mobile-label="Alertas"
              disabled={notificationLoading || notificationState === 'unsupported' || notificationState === 'denied'}
              onClick={handleNotifications}
              type="button"
            >
              <span className={styles.quickIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              </span>
              <span className={styles.quickLabel}>{notificationsEnabled ? 'Alertas activas' : notificationLoading ? 'Activando...' : 'Activar notificaciones'}</span>
            </button>
            <button className={styles.quickAction} data-mobile-label="Share" onClick={handleShare} type="button">
              <span className={styles.quickIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" /></svg>
              </span>
              <span className={styles.quickLabel}>{shareCopied ? 'Link copiado' : 'Compartir'}</span>
            </button>
          </div>

          <div className={styles.cardsStage}>
            <motion.div
              aria-hidden="true"
              className={styles.materiaBackdrop}
              ref={materiaRef}
              style={{
                x: materiaX,
                y: materiaY,
              }}
            >
              <div className={styles.materiaFloat}>
                <MateriaLogo
                  amplitude={7}
                  autoRotateIdle
                  baseColor={0x120d0a}
                  bloomIntensity={0.2}
                  cameraDistance={2700}
                  className={styles.materiaLogo}
                  cursorTilt
                  enableZoom={false}
                  environmentIntensity={0.18}
                  gyroscope
                  globalPointerHeat
                  heatColor={[0.98, 0.28, 0.08]}
                  heatEmissive={[1, 0.24, 0.02]}
                  heatEmissiveStrength={2.1}
                  heatTintStrength={1.1}
                  height="100%"
                  material={{ clearcoat: 0.32, clearcoatRoughness: 0.38, reflectivity: 0.08, roughness: 0.56 }}
                  preset="brasa"
                  svgUrl="/logo-gon-mark-3d.svg"
                  toneMappingExposure={0.78}
                  transparentBackground
                />
              </div>
            </motion.div>

            <nav className={styles.appGrid} aria-label="Herramientas GONOVI">
              {hubCards.map((card) => <HubCard card={card} key={card.title} />)}
            </nav>
          </div>
        </section>

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
      </section>
    </main>
  )
}
