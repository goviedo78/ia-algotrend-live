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

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] registered', reg.scope)
      })
      .catch((err) => {
        console.error('[SW] registration failed', err)
      })
  }, [])

  return null
}
