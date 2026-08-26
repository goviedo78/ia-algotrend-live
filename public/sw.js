// GONOVI Service Worker — PWA shell + push notifications.
//
// Regla central: las navegaciones NUNCA se cachean ni se sirven desde caché.
// Un documento HTML guardado de un deploy anterior apunta a chunks
// /_next/static/... que ya no existen en producción; al servirlo, React no
// hidrata nunca y el PWA queda mostrando el shell estático ("Reconectando",
// precios en cero) sin forma de recuperarse desde la pantalla de inicio.
const CACHE_NAME = 'gonovi-pwa-v4-20260826'
const PRECACHE = ['/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Documentos, bundles de Next y API: siempre red directa, sin caché.
  if (request.mode === 'navigate' || request.destination === 'document') return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname.startsWith('/api/')) return
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return

  // Assets estáticos propios (iconos, logos, manifest): red primero, caché de respaldo.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Solo se guardan respuestas sanas: un 404/502 cacheado envenena el PWA.
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'GONOVI', body: 'Nueva actualización disponible', tag: 'gonovi' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'signal',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/?source=notification' },
      actions: [{ action: 'open', title: 'Ver panel' }],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(event.notification.data?.url || '/?source=notification')
    })
  )
})
