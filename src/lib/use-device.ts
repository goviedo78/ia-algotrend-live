'use client'

import { useSyncExternalStore } from 'react'

// Hooks compartidos para detectar mobile y dispositivos low-end.
// useSyncExternalStore evita hydration mismatch entre SSR y client.
// Se usan en MateriaLoadingScreen (home) y LinksPage (/links) para
// configurar el MateriaLogo de Three.js con props apropiados según
// el dispositivo, sin flicker visual al cargar.

const subscribeMobile = (cb: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(max-width: 767px)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getMobileSnap = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
const getServerMobileSnap = () => false

export function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobileSnap, getServerMobileSnap)
}

// Dispositivos low-end donde el bloom de Three.js (la pasada de post-
// processing más costosa, ~3-5 ms/frame en Android medio-bajo) tira el
// frame rate. Criterios:
//  - prefers-reduced-motion: el usuario pidió menos animación (sistema)
//  - hardwareConcurrency <= 4: CPUs con pocos cores (Android baratos)
//  - deviceMemory <= 4 GB: dispositivos con poca RAM (no expuesto en iOS)
// iPhones y Androids decentes mantienen el bloom premium intacto.
type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number }

const subscribeLowEnd = (cb: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getLowEndSnap = () => {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  const nav = navigator as NavigatorWithDeviceMemory
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true
  return false
}
const getServerLowEndSnap = () => false

export function useIsLowEnd() {
  return useSyncExternalStore(subscribeLowEnd, getLowEndSnap, getServerLowEndSnap)
}
