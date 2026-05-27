'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIOSStandalone(): boolean {
  return 'standalone' in window.navigator && window.navigator.standalone === true
}

export function InstallPWA() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches || isIOSStandalone()
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handler = (e: Event) => {
        e.preventDefault()
        setPromptEvent(e as BeforeInstallPromptEvent)
      }
      window.addEventListener('beforeinstallprompt', handler)

      const ua = window.navigator.userAgent.toLowerCase()
      if (/iphone|ipad|ipod/.test(ua)) {
        queueMicrotask(() => setIsIOS(true))
      }

      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  if (isStandalone) return null

  if (promptEvent) {
    return (
      <button
        onClick={() => {
          promptEvent.prompt()
          promptEvent.userChoice.then(() => setPromptEvent(null))
          setIsStandalone(true)
        }}
        style={{
          background: 'rgba(79, 188, 114, 0.15)',
          color: '#86EFAC',
          border: '1px solid rgba(79, 188, 114, 0.3)',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(79, 188, 114, 0.25)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(79, 188, 114, 0.15)'
        }}
      >
        ↓ Instalar App
      </button>
    )
  }

  if (isIOS) {
    return (
      <div
        style={{
          background: 'rgba(28, 34, 58, 0.4)',
          color: '#E5D4B6',
          border: '1px solid rgba(79, 85, 112, 0.6)',
          padding: '0.4rem 0.8rem',
          borderRadius: '6px',
          fontSize: '0.7rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          whiteSpace: 'nowrap'
        }}
        title="Para instalar en iPhone, toca el ícono Compartir y luego 'Agregar a Inicio'"
      >
        <span>📱 Instalar:</span>
        <span style={{ opacity: 0.6 }}>Compartir → Agregar a Inicio</span>
      </div>
    )
  }

  return null
}
