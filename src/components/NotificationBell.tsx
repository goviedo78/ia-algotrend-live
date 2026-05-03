'use client'

import { useEffect, useState, useCallback } from 'react'

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

type PermState = 'default' | 'granted' | 'denied' | 'unsupported'

export default function NotificationBell() {
  const [permState, setPermState] = useState<PermState>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- Browser API sync: Notification.permission + SW subscription check */
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermState('unsupported')
      return
    }
    setPermState(Notification.permission as PermState)

    // Check existing subscription
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    })
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const subscribe = useCallback(async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setPermState(permission as PermState)
      if (permission !== 'granted') {
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        // Fallback: just enable local notifications via the service worker
        setIsSubscribed(true)
        setLoading(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('[subscribe]', err)
    }
    setLoading(false)
  }, [])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setIsSubscribed(false)
    } catch (err) {
      console.error('[unsubscribe]', err)
    }
    setLoading(false)
  }, [])

  if (permState === 'unsupported') return null

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading || permState === 'denied'}
      className={[
        'glass-btn',
        isSubscribed ? 'glass-btn-success' : 'glass-btn-primary',
        permState === 'denied' ? 'opacity-40 !cursor-not-allowed' : '',
        loading ? 'animate-pulse' : ''
      ].join(' ')}
      title={
        permState === 'denied'
          ? 'Las notificaciones están bloqueadas en tu navegador'
          : isSubscribed
            ? 'Notificaciones activadas — click para desactivar'
            : 'Activar notificaciones de señales'
      }
    >
      <span className="text-base leading-none">{isSubscribed ? '🔔' : '🔕'}</span>
      {isSubscribed ? 'Alertas activas' : 'Activar alertas'}
    </button>
  )
}
