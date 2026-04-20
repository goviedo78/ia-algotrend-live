'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setDeferredPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  // Already installed or not available
  if (installed) {
    return (
      <span className="badge inline-flex items-center gap-1.5" style={{ opacity: 0.6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Instalada
      </span>
    )
  }

  if (!deferredPrompt) {
    // Show hint for iOS Safari (which doesn't support beforeinstallprompt)
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      return (
        <button
          className="badge badge-live inline-flex items-center gap-1.5 cursor-pointer hover:brightness-125 transition-all"
          onClick={() => alert('Para instalar:\n\n1. Toca el botón de Compartir (📤)\n2. Selecciona "Agregar a pantalla de inicio"\n3. Confirma con "Agregar"')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Instalar App
        </button>
      )
    }
    return null // Browser doesn't support PWA install
  }

  return (
    <button
      onClick={handleInstall}
      className="badge badge-live inline-flex items-center gap-1.5 cursor-pointer hover:brightness-125 transition-all animate-pulse"
      style={{ animationDuration: '2s' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Instalar App
    </button>
  )
}
