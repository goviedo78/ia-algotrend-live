'use client'

/**
 * GonEmblem3D — micro variant del MateriaLogo para uso en headers/firmas.
 *
 * Monta el MateriaLogo en un canvas chico (default 40px), con todas las
 * interacciones desactivadas (no tilt, no zoom, no autorotate, no entry).
 * Solo el shader respirando + el preset brasa. Costo GPU mínimo.
 *
 * Si el usuario tiene prefers-reduced-motion, cae a un img estático del SVG.
 */

import { useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'

const MateriaLogo = dynamic(
  () => import('./MateriaLogo').then((m) => m.MateriaLogo),
  { ssr: false, loading: () => <div /> }
)

export interface GonEmblem3DProps {
  /** Lado del canvas en px. Default 40. */
  size?: number
  /** Cuando es true monta el 3D real. Cuando es false (o reduced-motion) → SVG. */
  enable3D?: boolean
  /** Class CSS extra para el wrapper. */
  className?: string
}

// useSyncExternalStore — patrón correcto React 19 para suscribirse a matchMedia
// sin disparar cascading renders. SSR-safe via getServerSnapshot.
const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReduceMotion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(REDUCE_MOTION_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getReduceMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(REDUCE_MOTION_QUERY).matches
}

function getReduceMotionServerSnapshot(): boolean {
  return false // SSR default: asumimos full motion, en el cliente se resincroniza
}

export function GonEmblem3D({ size = 40, enable3D = true, className }: GonEmblem3DProps) {
  const reduceMotion = useSyncExternalStore(
    subscribeReduceMotion,
    getReduceMotionSnapshot,
    getReduceMotionServerSnapshot
  )

  const useStatic = !enable3D || reduceMotion

  if (useStatic) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          src="/logo-gon-mark.svg"
          alt="GON"
          width={size}
          height={size}
          priority
          style={{ filter: 'drop-shadow(0 0 4px rgba(244,78,28,0.28))' }}
        />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        // Aislamos el GPU compositor para que el bg radial no afecte
        isolation: 'isolate',
      }}
    >
      <MateriaLogo
        height={size}
        preset="brasa"
        amplitude={3}
        cameraDistance={1500}
        entryAnimation={false}
        cursorTilt={false}
        autoRotateIdle={false}
        gyroscope={false}
        enableZoom={false}
        bloom={false}
        transparentBackground
      />
    </div>
  )
}

export default GonEmblem3D
