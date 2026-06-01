'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import styles from './official-home.module.css'
import { track } from '@/lib/client-analytics'
import { createClient } from '@/lib/supabase/client'
import { MateriaLoadingScreen } from '@/components/ui/MateriaLoadingScreen'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type NotificationState = 'default' | 'granted' | 'denied' | 'unsupported'

const noop = () => {}
const OFFICIAL_BETA_VERSION = 'Beta v3.1'

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
    summary: 'Señales live',
    text: 'Librería de señales AlgoTrend en tiempo real.',
    href: 'https://algotrend.gonovi.app',
    cta: 'Abrir demo',
    side: 'left' as const, external: true,
  },
  {
    num: '02', label: 'Resultados',
    title: 'Resultados en vivo',
    summary: 'WR mensual',
    text: 'Rendimiento mensual de BTC 1H, Oro 15M y Oro 30M.',
    href: '/official/estrategias',
    cta: 'Ganancias / Pérdidas',
    side: 'right' as const, external: false,
  },
  {
    num: '03', label: 'Práctica',
    title: 'Centro de Entrenamiento',
    summary: 'Lab interactivo',
    text: 'Trading Lab, Backtesting vela a vela y retos interactivos.',
    href: '/official/practica',
    cta: 'Mejorá tu análisis',
    side: 'left' as const, external: false,
  },
  {
    num: '04', label: 'Auditoría',
    title: 'Auditoría Montecarlo',
    summary: 'Riesgo extremo',
    text: 'Stress test, drawdown extremo y probabilidad de ruina.',
    href: '/official/montecarlo',
    cta: 'Análisis de datos',
    side: 'right' as const, external: false,
  },
  {
    num: '05', label: 'Educación',
    title: 'Videos y Tutoriales',
    summary: 'YouTube + setups',
    text: 'Análisis, setups y masterclasses en YouTube.',
    href: '/official/videos',
    cta: 'Videos',
    side: 'left' as const, external: false,
  },
  {
    num: '06', label: 'Licencia',
    title: 'Obtener Script',
    summary: 'Pine completo',
    text: 'Código fuente Pine Script completo, entrega inmediata.',
    href: '/official/store',
    cta: 'Descargar',
    side: 'right' as const, external: false,
  },
]

const priorityPrefetchRoutes = [
  '/official/estrategias',
  '/official/practica',
  '/official/store',
  '/links',
]

const secondaryPrefetchRoutes = [
  '/official/montecarlo',
  '/official/lab',
  '/official/backtesting',
  '/official/academia',
  '/official/videos',
  '/official/checkout',
  '/official/soporte',
  '/official/instalacion',
  '/official/docs',
  '/official/community',
  '/official/dashboard',
  '/account',
  '/auth',
]

const HubCard = memo(function HubCard({
  active,
  card,
  cardIndex,
  copyIndex,
  onRoutePrepare,
  onRouteStart,
}: {
  active: boolean
  card: typeof hubCards[number]
  expanded: boolean
  cardIndex: number
  copyIndex: number
  onExpand: (cardIndex: number) => void
  onRoutePrepare: (href: string, external: boolean) => void
  onRouteStart: (title: string, href: string, external: boolean) => void
}) {
  const handleOpen = useCallback(() => {
    track({ event_type: 'hub_card_click', card_id: card.num, card_title: card.title, path: '/official' })
  }, [card.num, card.title])

  const prepareRoute = useCallback(() => {
    onRoutePrepare(card.href, card.external)
  }, [card.external, card.href, onRoutePrepare])

  // 1 tap = navega directo. Sin expand intermedio: el summary y el text
  // se muestran siempre. Usamos un <a> envolvente para que el browser
  // trate la card como link nativo (mejor accesibilidad + no requiere
  // JS para clickear). El prefetch se dispara on hover/focus.
  const commonProps = {
    className: styles.heroNavCard,
    'data-active': active ? 'true' : undefined,
    'data-card-index': cardIndex,
    'data-copy-index': copyIndex,
    onMouseEnter: prepareRoute,
    onFocus: prepareRoute,
    style: { '--card-i': cardIndex } as CSSProperties,
  }

  const inner = (
    <>
      <span className={styles.heroCardEyebrow}>{card.num} · {card.label}</span>
      <strong className={styles.heroCardTitle}>{card.title}</strong>
      <p className={styles.heroCardSummary}>{card.summary}</p>
      <p className={styles.heroCardText}>{card.text}</p>
      <span className={styles.heroCardOpen}>
        {card.cta ? `${card.cta} →` : (card.external ? 'Abrir demo →' : 'Abrir sección →')}
      </span>
    </>
  )

  // External: <a> nativo con target="_blank". onClick solo trackea, sin
  // preventDefault: el browser hace la navegación.
  if (card.external) {
    return (
      <a
        {...commonProps}
        href={card.href}
        rel="noreferrer"
        target="_blank"
        onClick={handleOpen}
      >
        {inner}
      </a>
    )
  }

  // Interno: <Link> + LinkPendingIndicator. El indicator usa
  // useLinkStatus() de Next 16 internamente y avisa al padre cuando
  // está navegando. NO tocamos onClick para no romper el flow del Link.
  return (
    <Link {...commonProps} href={card.href}>
      <LinkPendingIndicator title={card.title} onPendingChange={onRouteStart} />
      {inner}
    </Link>
  )
})

// Componente sentinel — debe vivir adentro del <Link> de Next 16 para
// que useLinkStatus() detecte el estado "pending" de esa navegación
// específica. Notifica al padre via callback estable.
const LinkPendingIndicator = memo(function LinkPendingIndicator({
  title,
  onPendingChange,
}: {
  title: string
  onPendingChange: (title: string, href: string, external: boolean) => void
}) {
  const { pending } = useLinkStatus()
  useEffect(() => {
    if (pending) onPendingChange(title, '', false)
  }, [pending, title, onPendingChange])
  return null
})

export default function OfficialHome() {
  const pathname = usePathname()
  const router = useRouter()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const topBannerRef = useRef<HTMLDivElement>(null)
  const bottomBannerRef = useRef<HTMLDivElement>(null)
  const logoBaseScrollRef = useRef<number | null>(null)
  const logoViewportRef = useRef<{ width: number; height: number } | null>(null)
  const [user, setUser] = useState<{ id: string; email: string } | null | undefined>(undefined)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [notificationState, setNotificationState] = useState<NotificationState>('default')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [isCarouselAtTop, setIsCarouselAtTop] = useState(true)
  const [routeLoadingLabel, setRouteLoadingLabel] = useState<string | null>(null)
  // En touch devices: primer tap expande el botón (preview del label), segundo tap confirma.
  const [confirmingAction, setConfirmingAction] = useState<'install' | 'notify' | 'share' | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Prefetch escalonado: cache amplio sin trabar el primer render mobile.
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    const timers: number[] = []
    const schedulePrefetch = (routes: string[], delay: number, batchSize: number) => {
      routes.forEach((path, index) => {
        timers.push(window.setTimeout(() => router.prefetch(path), delay + Math.floor(index / batchSize) * 550))
      })
    }

    schedulePrefetch(priorityPrefetchRoutes, mobile ? 1300 : 450, mobile ? 1 : 2)
    schedulePrefetch(secondaryPrefetchRoutes, mobile ? 3600 : 1200, mobile ? 2 : 4)

    return () => timers.forEach((id) => window.clearTimeout(id))

  }, [router])

  const prepareRoute = useCallback((href: string, external: boolean) => {
    if (external || !href.startsWith('/')) return
    router.prefetch(href)
  }, [router])

  // startRoute SOLO muestra el loading label. La navegación la hace el
  // <Link>/<a> nativo del HubCard. Esto garantiza que el tap nunca
  // quede muerto: aunque este handler falle, el browser igual navega.
  const startRoute = useCallback((title: string, _href: string, external: boolean) => {
    setRouteLoadingLabel(title)
    // External: el target="_blank" del <a> abre la nueva tab; ocultamos
    // el loading rápido porque la página actual no cambia.
    if (external) {
      window.setTimeout(() => setRouteLoadingLabel(null), 900)
    }
  }, [])

  // Quick-action: Ejecuta la acción inmediatamente y expande el botón
  // para dar feedback visual al usuario en móviles. Auto-cierra a los 3s.
  const requestActionConfirm = useCallback(
    (id: 'install' | 'notify' | 'share', action: () => void) => {
      // Disparamos la acción de inmediato, sin requerir doble tap.
      action()
      
      // Expandimos visualmente el botón para dar un feedback claro.
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      setConfirmingAction(id)
      confirmTimerRef.current = setTimeout(() => setConfirmingAction(null), 3000)
    },
    []
  )

  // Cierra el preview si tapeás fuera de la barra de acciones rápidas
  useEffect(() => {
    if (!confirmingAction) return
    const close = (e: Event) => {
      const target = e.target as Element | null
      if (target?.closest(`.${styles.quickActions}`) || target?.closest(`.${styles.mobileDock}`)) return
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      setConfirmingAction(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [confirmingAction])

  // Cleanup del timer al desmontar
  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
  }, [])

  // ── Carrusel mobile RECTO ────────────────────────────────────────
  // Sin loop infinito. Sin bend matemático. Cards apiladas verticales
  // con scroll natural del browser. Base limpia para iterar la
  // animación desde acá.
  const [isMobileCarousel, setIsMobileCarousel] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobileCarousel(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Sin loop: una sola copia de cada card. El scroll natural del
  // carrusel maneja la navegación; no se duplican cards y los taps
  // siempre llegan al handler sin interferencias.
  type RenderItem = { card: typeof hubCards[number]; cardIndex: number }

  const renderItems = useMemo<RenderItem[]>(
    () => hubCards.map((card, cardIndex) => ({ card, cardIndex })),
    []
  )

  const bendFrameRef = useRef<number | null>(null)


  // Punto "activo" del carrusel: 40% desde el top del cardsStage (no
  // el centro 50%). Esto hace que la card activa se vea visualmente
  // arriba del medio del viewport, dejando más respiro abajo y menos
  // espacio vacío arriba.
  const ACTIVE_POINT_RATIO = 0.4

  const syncActiveCard = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    const carouselRect = carousel.getBoundingClientRect()
    const activeY = carouselRect.top + carouselRect.height * ACTIVE_POINT_RATIO
    let nearestCardIndex = 0
    let nearest = Number.POSITIVE_INFINITY
    carousel.querySelectorAll<HTMLElement>('[data-card-index]').forEach((node) => {
      const cardIndex = Number(node.dataset.cardIndex)
      const rect = node.getBoundingClientRect()
      const cardCenter = rect.top + rect.height / 2
      const distance = Math.abs(cardCenter - activeY)
      if (distance < nearest) {
        nearest = distance
        nearestCardIndex = cardIndex
      }
    })
    setActiveCardIndex((current) => (current === nearestCardIndex ? current : nearestCardIndex))
  }, [])

  // Mobile: el logo conserva su posición inicial exacta. El drift se
  // calcula desde el scroll inicial real del carrusel y converge hacia
  // el centro visual de la pantalla: más eje X, menos eje Y, sin saltos.
  const updateLogoMotion = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    const { scrollTop, scrollHeight, clientHeight } = carousel
    const maxScroll = Math.max(1, scrollHeight - clientHeight)
    if (logoBaseScrollRef.current === null) {
      logoBaseScrollRef.current = scrollTop
    }
    if (logoViewportRef.current === null) {
      logoViewportRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    }
    const baseScroll = logoBaseScrollRef.current
    const stableViewport = logoViewportRef.current
    const delta = scrollTop - baseScroll
    const direction = delta === 0 ? 0 : Math.sign(delta)
    const available = direction < 0
      ? Math.max(1, baseScroll)
      : Math.max(1, maxScroll - baseScroll)
    const progress = Math.min(1, Math.abs(delta) / available)
    const eased = 1 - Math.pow(1 - progress, 2)
    const shiftX = stableViewport.width * 0.17 * eased
    const verticalFactor = direction < 0 ? 0.2 : 0.075
    const shiftY = stableViewport.height * verticalFactor * eased * direction
    const wrapper = document.querySelector<HTMLElement>('[data-logo-placement="left"] [class*="materiaWrapper"]')
    wrapper?.style.setProperty('--gonovi-logo-shift-x', shiftX.toFixed(1))
    wrapper?.style.setProperty('--gonovi-logo-shift-y', shiftY.toFixed(1))
  }, [])

  // Scroll inicial: centra la card 01 al montar (mobile). Padding-block
  // 42vh del cardsStage permite que la 01 y la 06 lleguen al centro.
  // Encadenamos scroll → rAF → sync para que el activeCardIndex se
  // calcule DESPUÉS de que el browser aplicó el scrollTop.
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) {
      syncActiveCard()
      return
    }
    if (!isMobileCarousel) {
      syncActiveCard()
      return
    }
    const first = carousel.querySelector<HTMLElement>('[data-card-index="0"]')
    if (first) {
      // Scroll para que el centro de la card 01 coincida con el
      // ACTIVE_POINT_RATIO (40% desde top), no con el centro.
      const carouselRect = carousel.getBoundingClientRect()
      const cardRect = first.getBoundingClientRect()
      const currentCardCenterFromCarouselTop = (cardRect.top - carouselRect.top) + cardRect.height / 2
      const targetCenterFromCarouselTop = carouselRect.height * ACTIVE_POINT_RATIO
      const delta = currentCardCenterFromCarouselTop - targetCenterFromCarouselTop
      carousel.scrollTop = Math.max(0, carousel.scrollTop + delta)
    }
    // Esperar 2 frames para que el browser termine de aplicar el scroll
    // antes de leer la posición y decidir activeCardIndex.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        logoBaseScrollRef.current = carousel.scrollTop
        setIsCarouselAtTop(carousel.scrollTop <= 4)
        syncActiveCard()
        updateLogoMotion()
      })
    })
    return () => cancelAnimationFrame(raf1)
  }, [syncActiveCard, isMobileCarousel, updateLogoMotion])

  useEffect(() => () => {
    if (bendFrameRef.current) cancelAnimationFrame(bendFrameRef.current)
  }, [])

  // Aparición sutil de los banners: IntersectionObserver dentro del
  // viewport del cardsStage. Cuando el banner está al menos 30% visible
  // setea data-visible="true" → CSS hace fade-in con opacity + translateY.
  // No depende de scroll handler (más barato + más limpio).
  useEffect(() => {
    if (!isMobileCarousel) return
    const carousel = carouselRef.current
    if (!carousel) return
    const banners = [topBannerRef.current, bottomBannerRef.current].filter(Boolean) as HTMLElement[]
    if (!banners.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ;(entry.target as HTMLElement).dataset.visible = entry.isIntersecting ? 'true' : 'false'
        })
      },
      { root: carousel, threshold: 0.3 }
    )
    banners.forEach((b) => observer.observe(b))
    return () => observer.disconnect()
  }, [isMobileCarousel])

  const handleCarouselScroll = useCallback(() => {
    if (bendFrameRef.current) cancelAnimationFrame(bendFrameRef.current)
    bendFrameRef.current = requestAnimationFrame(() => {
      bendFrameRef.current = null
      const carousel = carouselRef.current
      if (carousel) {
        setIsCarouselAtTop(carousel.scrollTop <= 4)
      }
      syncActiveCard()
      updateLogoMotion()
    })
  }, [syncActiveCard, updateLogoMotion])

  const handleDockHome = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    setIsCarouselAtTop(true)
    carousel.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])


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

  /* eslint-disable react-hooks/set-state-in-effect -- Menus must close immediately after route changes. */
  useEffect(() => {
    setMenuOpen(false)
    setUserMenuOpen(false)
    setRouteLoadingLabel(null)
  }, [pathname])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /* ── Auth Session ── */
  useEffect(() => {
    const supabase = createClient()
    
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email! } : null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email! } : null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /* ── User Menu Dropdown ── */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [userMenuOpen])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUserMenuOpen(false)
      setMenuOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Logout error', err)
    }
  }

  return (
    <MateriaLoadingScreen badgeText="GONOVI . INICIO" logoPlacement="left" waitDuration={2500}>
    <main className={styles.shell}>
      {/* SVG filter usado por .heroNavCard::before para el efecto liquid
          glass tipo Apple — refracción + distorsión líquida sobre el
          contenido detrás. Inline para no requerir asset externo. */}
      <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <filter id="gonovi-liquid-glass" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="17" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className={styles.noise} />
      <div className={styles.shardOne} aria-hidden="true" />
      <div className={styles.shardTwo} aria-hidden="true" />
      <div className={styles.shardThree} aria-hidden="true" />

      <section className={`${styles.appFrame} ${styles.appFrameHome}`} aria-label="GONOVI Inicio">
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandDot} aria-hidden="true" />
            GONOVI
          </div>
          <nav className={styles.topnav} aria-label="Navegación principal">
            <Link href="/official" className={pathname === '/official' ? styles.topnavActive : ''} aria-current={pathname === '/official' ? 'page' : undefined}>Inicio</Link>
            <Link href="/official/montecarlo" className={pathname === '/official/montecarlo' ? styles.topnavActive : ''} aria-current={pathname === '/official/montecarlo' ? 'page' : undefined}>Auditoría</Link>
            <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? styles.topnavActive : ''} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Resultados</Link>
            <Link href="/official/soporte" className={pathname === '/official/soporte' ? styles.topnavActive : ''} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>
          </nav>
          <div className={styles.session}>
            {user === undefined ? (
              <div className={styles.authSkeleton} aria-hidden="true" />
            ) : user === null ? (
              <Link href="/auth" className={styles.loginButton}>Iniciar sesión</Link>
            ) : (
              <div className={styles.userMenuWrapper} ref={userMenuRef}>
                <button 
                  className={styles.userMenuTrigger} 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-controls="user-dropdown"
                >
                  <div className={styles.userAvatar}>
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className={styles.userEmail}>
                    {user.email.split('@')[0]}
                  </span>
                  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div id="user-dropdown" className={styles.userMenuDropdown} role="menu">
                    <Link href="/account" className={styles.userMenuItem} role="menuitem">Mi cuenta</Link>
                    <button onClick={handleLogout} className={styles.userMenuItem} role="menuitem">Cerrar sesión</button>
                  </div>
                )}
              </div>
            )}
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
              <Link href="/official" className={pathname === '/official' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official' ? 'page' : undefined}>Inicio</Link>
              <Link href="/official/montecarlo" className={pathname === '/official/montecarlo' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/montecarlo' ? 'page' : undefined}>Auditoría</Link>
              <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Resultados</Link>
              <Link href="/official/soporte" className={pathname === '/official/soporte' ? styles.menuLinkActive : styles.menuLink} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>

              <div className={styles.menuLinkDivider} aria-hidden="true" />

              {user === undefined ? null : user === null ? (
                <Link href="/auth" className={styles.menuLink}>Iniciar sesión</Link>
              ) : (
                <>
                  <Link href="/account" className={styles.menuLink}>Mi cuenta — {user.email.split('@')[0]}</Link>
                  <button className={styles.menuLinkButton} onClick={handleLogout}>Cerrar sesión</button>
                </>
              )}
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
          <span className={styles.betaWatermark} aria-label={`Versión ${OFFICIAL_BETA_VERSION}`}>
            {OFFICIAL_BETA_VERSION}
          </span>

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
              <span className={styles.profileEyebrow}>GONOVI · OFICIAL</span>
              <h1>Canales y recursos</h1>
              <p>Todo lo importante en una sola página.</p>
            </div>
            <Link className={styles.profileAction} href="/links">
              Ver canales →
            </Link>
          </div>

          <div className={styles.quickActions} aria-label="Acciones rápidas">
            <button
              className={styles.quickAction}
              data-mobile-label="App"
              data-expanded={(installed || confirmingAction === 'install') ? 'true' : undefined}
              disabled={installed || (!deferredPrompt && typeof navigator !== 'undefined' && !/iPad|iPhone|iPod/.test(navigator.userAgent))}
              onClick={() => requestActionConfirm('install', handleInstall)}
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
              data-expanded={(notificationsEnabled || notificationLoading || confirmingAction === 'notify') ? 'true' : undefined}
              disabled={notificationLoading || notificationState === 'unsupported' || notificationState === 'denied'}
              onClick={() => requestActionConfirm('notify', handleNotifications)}
              type="button"
            >
              <span className={styles.quickIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              </span>
              <span className={styles.quickLabel}>{notificationsEnabled ? 'Alertas activas' : notificationLoading ? 'Activando...' : 'Activar notificaciones'}</span>
            </button>
            <button className={styles.quickAction} data-mobile-label="Share" data-expanded={(shareCopied || confirmingAction === 'share') ? 'true' : undefined} onClick={() => requestActionConfirm('share', handleShare)} type="button">
              <span className={styles.quickIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" /></svg>
              </span>
              <span className={styles.quickLabel}>{shareCopied ? 'Link copiado' : 'Compartir'}</span>
            </button>
          </div>

          <nav className={styles.mobileDock} aria-label="Navegación rápida móvil">
            <Link
              className={`${styles.mobileDockAction} ${pathname === '/official/estrategias' ? styles.mobileDockActive : ''}`}
              href="/official/estrategias"
              aria-current={pathname === '/official/estrategias' ? 'page' : undefined}
            >
              <span className={styles.mobileDockIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7" /></svg>
              </span>
              <span>Gráfico</span>
            </Link>
            <button
              className={`${styles.mobileDockAction} ${styles.mobileDockPrimary} ${isCarouselAtTop ? styles.mobileDockPrimaryIdle : styles.mobileDockActive}`}
              aria-label="Volver al inicio del carrusel"
              onClick={handleDockHome}
              type="button"
            >
              <span className={styles.mobileDockIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H5v-8.5" /></svg>
              </span>
              <span>Inicio</span>
            </button>
            <Link
              className={`${styles.mobileDockAction} ${pathname === '/official/apps' ? styles.mobileDockActive : ''}`}
              href="/official/apps"
              aria-current={pathname === '/official/apps' ? 'page' : undefined}
            >
              <span className={styles.mobileDockIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
              </span>
              <span>Apps</span>
            </Link>
          </nav>

          {routeLoadingLabel && (
            <div className={styles.routeLoading} aria-live="polite" role="status">
              <span className={styles.routeLoadingPulse} aria-hidden="true" />
              Cargando {routeLoadingLabel}
            </div>
          )}

          <div className={styles.cardsStage} onScroll={handleCarouselScroll} ref={carouselRef}>
            <nav className={styles.appGrid} aria-label="Herramientas GONOVI">
              {/* Banner top: aparece sutilmente cuando intersecta el
                  viewport (IntersectionObserver → data-visible). Texto
                  alineado con la versión web de /links. */}
              <div className={styles.carouselBannerTop} aria-hidden="true" ref={topBannerRef}>
                <span className={styles.carouselBannerEyebrow}>GONOVI · OFICIAL</span>
                <strong className={styles.carouselBannerTitle}>Canales y recursos</strong>
                <span className={styles.carouselBannerSubtitle}>Todo lo importante en una sola página.</span>
              </div>

              {renderItems.map((item) => (
                <HubCard
                  key={item.card.title}
                  active={item.cardIndex === activeCardIndex}
                  card={item.card}
                  cardIndex={item.cardIndex}
                  copyIndex={0}
                  expanded={false}
                  onExpand={noop}
                  onRoutePrepare={prepareRoute}
                  onRouteStart={startRoute}
                />
              ))}

              {/* Banner bottom: cierra el recorrido con la misma
                  estética sutil. Aparece via IntersectionObserver
                  cuando entra al viewport. */}
              <div className={styles.carouselBannerBottom} aria-hidden="true" ref={bottomBannerRef}>
                <span className={styles.carouselBannerEyebrow}>GONOVI · 2026</span>
                <strong className={styles.carouselBannerTitle}>Recorrido completo</strong>
                <span className={styles.carouselBannerSubtitle}>Volvé arriba cuando quieras seguir explorando.</span>
              </div>
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
    </MateriaLoadingScreen>
  )
}
