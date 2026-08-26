'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const isLocalDev =
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
        .then(() => ('caches' in window ? window.caches.keys() : []))
        .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
        .catch((err) => {
          console.warn('[SW] local cleanup failed', err)
        })
      return
    }

    let registration: ServiceWorkerRegistration | null = null

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg
        console.log('[SW] registered', reg.scope)
      })
      .catch((err) => {
        console.error('[SW] registration failed', err)
      })

    // El PWA instalado se reanuda sin navegar, así que el navegador no revisa
    // /sw.js por su cuenta. Sin esto, un service worker viejo puede quedar
    // sirviendo caché rancia por días en el teléfono.
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    return () => document.removeEventListener('visibilitychange', checkForUpdate)
  }, [])

  return null
}
