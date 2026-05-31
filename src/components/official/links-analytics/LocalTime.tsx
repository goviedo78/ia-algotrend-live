'use client'

import { useEffect, useState } from 'react'

interface Props {
  iso: string
}

// Renderiza la fecha en hora local del visitante (Hydration-safe).
// El SSR muestra el ISO crudo para evitar mismatch; al hidratar, se reemplaza
// con la fecha formateada en la timezone del navegador.
export function LocalTime({ iso }: Props) {
  const [pretty, setPretty] = useState<string | null>(null)

  useEffect(() => {
    try {
      const d = new Date(iso)
      const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      setPretty(`${dateStr} · ${timeStr}`)
    } catch {
      setPretty(iso)
    }
  }, [iso])

  return <time dateTime={iso} title={iso}>{pretty ?? iso.substring(0, 16).replace('T', ' ')}</time>
}
