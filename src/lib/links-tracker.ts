// Cliente de tracking para /links. Maneja:
// - sessionId persistente en localStorage (1 año vía no-expira-default)
// - parseo de UTM desde la URL
// - envío via sendBeacon cuando es posible (sobrevive a navegación)
//
// Privacidad: NO guardamos IP cruda ni PII. El backend hashea la IP con sal
// secreta (NFC_HASH_SALT). El sessionId es un UUID anónimo solo para
// distinguir visitantes únicos vs repetidos en el dashboard.

const SESSION_KEY = 'gonovi_links_session'
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export interface TrackEventPayload {
  event: 'view' | 'click'
  sessionId: string
  referrer: string
  utm: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
  link?: {
    title: string
    href: string
    index: number
  }
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback ultraconservador (browsers viejos en jails). Suficientemente único.
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing && UUID_RE.test(existing)) return existing
    const fresh = generateUuid()
    window.localStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    // localStorage bloqueado (modo incógnito con storage off, iframe, etc.)
    return ''
  }
}

function parseUtm(): TrackEventPayload['utm'] {
  if (typeof window === 'undefined') return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const pick = (k: string) => params.get(k)?.substring(0, 100) || undefined
    return {
      source: pick('utm_source'),
      medium: pick('utm_medium'),
      campaign: pick('utm_campaign'),
      content: pick('utm_content'),
      term: pick('utm_term'),
    }
  } catch {
    return {}
  }
}

function send(payload: TrackEventPayload, opts: { beacon: boolean }) {
  const url = '/api/links/track'
  const body = JSON.stringify(payload)
  try {
    if (opts.beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(url, blob)
      if (ok) return
    }
    // Fallback: fetch keepalive (sobrevive navegación en browsers modernos).
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Tracking nunca debe romper la UI. Silenciar.
  }
}

export function trackView() {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateSessionId()
  const referrer = (document.referrer || '').substring(0, 500)
  send(
    {
      event: 'view',
      sessionId,
      referrer,
      utm: parseUtm(),
    },
    { beacon: false }, // view ocurre al cargar; fetch normal está bien
  )
}

export function trackClick(link: { title: string; href: string; index: number }) {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateSessionId()
  const referrer = (document.referrer || '').substring(0, 500)
  send(
    {
      event: 'click',
      sessionId,
      referrer,
      utm: parseUtm(),
      link: {
        title: link.title.substring(0, 120),
        href: link.href.substring(0, 500),
        index: link.index,
      },
    },
    { beacon: true }, // click suele preceder navegación → beacon
  )
}
