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

// Tier de capacidad GPU/CPU. El bloom de Three.js (post-processing más
// costoso, ~3-5 ms/frame) tira el frame rate en gama media-baja con GPU
// vieja (ej. P30 Pro con Mali-G76, pasa concurrency=8 / RAM=6 pero la GPU
// no banca el bloom). Por eso tier !== binario.
//  - low : prefers-reduced-motion / Androids muy baratos
//  - mid : Androids medios con GPU vieja (P30 Pro, gama 2019-2021)
//  - high: iPhones (Apple ofusca specs pero las GPUs banca todo) + Androids
//          modernos + desktop
// Apple Safari capa hardwareConcurrency a 6 y oculta deviceMemory, por eso
// los iPhones caen a 'high' por UA detection directa (no por specs).
export type DeviceTier = 'low' | 'mid' | 'high'

type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number }

const subscribeDeviceTier = (cb: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getDeviceTierSnap = (): DeviceTier => {
  if (typeof window === 'undefined') return 'high'
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low'

  const nav = navigator as NavigatorWithDeviceMemory
  const ua = nav.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  if (isIOS) return 'high'

  if (typeof nav.deviceMemory === 'number') {
    if (nav.deviceMemory <= 3) return 'low'
    if (nav.deviceMemory <= 6) return 'mid'
    return 'high'
  }

  if (typeof nav.hardwareConcurrency === 'number') {
    if (nav.hardwareConcurrency <= 4) return 'low'
    if (nav.hardwareConcurrency <= 6) return 'mid'
  }

  return 'high'
}
const getServerDeviceTierSnap = (): DeviceTier => 'high'

export function useDeviceTier() {
  return useSyncExternalStore(subscribeDeviceTier, getDeviceTierSnap, getServerDeviceTierSnap)
}

// Back-compat: useIsLowEnd retorna true para low Y mid.
// El bloom se apaga en ambos tiers porque mid (ej. P30 Pro) tampoco lo banca.
export function useIsLowEnd() {
  return useDeviceTier() !== 'high'
}
