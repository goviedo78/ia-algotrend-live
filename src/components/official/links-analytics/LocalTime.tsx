'use client'

import { useSyncExternalStore } from 'react'

interface Props {
  iso: string
}

// Hydration-safe: durante SSR y primer render cliente devolvemos un fallback;
// useSyncExternalStore con getServerSnapshot evita el patrón "setState in effect"
// que el lint estricto del repo prohíbe. Después de hidratar, formateamos la
// fecha en la timezone local del visitante.
function subscribe() {
  // El valor no cambia después de hidratar, así que no necesitamos
  // suscripciones reales. Devolvemos un unsubscribe noop.
  return () => {}
}

function getHydrated(): boolean {
  return true
}

function getServerHydrated(): boolean {
  return false
}

function formatLocal(iso: string): string {
  try {
    const d = new Date(iso)
    const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
    const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
  } catch {
    return iso
  }
}

export function LocalTime({ iso }: Props) {
  const isHydrated = useSyncExternalStore(subscribe, getHydrated, getServerHydrated)
  const text = isHydrated ? formatLocal(iso) : iso.substring(0, 16).replace('T', ' ')
  return (
    <time dateTime={iso} title={iso}>
      {text}
    </time>
  )
}
