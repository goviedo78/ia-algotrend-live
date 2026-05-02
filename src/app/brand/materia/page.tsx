'use client'

import { useEffect, useState } from 'react'
import { MateriaLogo, type LightConfig } from '@/components/brand/MateriaLogo'

const MATERIA_BRASA_LIGHTS: LightConfig[] = [
  { type: 'ambient', color: 0x1b120d, intensity: 0.62 },
  { type: 'directional', color: 0xf44e1c, intensity: 2.65, position: [0, 90, -520] },
  { type: 'directional', color: 0xff6a21, intensity: 1.7, position: [-320, 360, 520] },
  { type: 'directional', color: 0x8f2d15, intensity: 0.72, position: [460, -120, 260] },
  { type: 'directional', color: 0xff8a3d, intensity: 0.38, position: [-260, 420, 620] },
]

type MotionState = 'hidden' | 'ready' | 'requesting' | 'active' | 'denied'

export default function MateriaPage() {
  const [motionState, setMotionState] = useState<MotionState>('hidden')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    if (typeof DeviceOrientationEvent === 'undefined') return

    const mobileQuery = window.matchMedia('(hover: none), (pointer: coarse)')
    const syncVisibility = () => setMotionState((state) => {
      if (state === 'active' || state === 'denied' || state === 'requesting') return state
      return mobileQuery.matches ? 'ready' : 'hidden'
    })
    const onGyroStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status
      setMotionState(status === 'granted' ? 'active' : 'denied')
    }

    syncVisibility()
    mobileQuery.addEventListener('change', syncVisibility)
    window.addEventListener('gonovi:gyro-status', onGyroStatus)

    return () => {
      mobileQuery.removeEventListener('change', syncVisibility)
      window.removeEventListener('gonovi:gyro-status', onGyroStatus)
    }
  }, [])

  const activateMotion = () => {
    setMotionState('requesting')
    window.dispatchEvent(new Event('gonovi:request-gyro'))
  }

  return (
    <main style={styles.main}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.hud}>
        <span style={styles.badge}>GONOVI · CONCEPTO 3</span>
        <div style={styles.title}>MATERIA</div>
        <div style={styles.meta}>THREE.JS · MESHPHYSICALMATERIAL · NOISE DISPLACEMENT</div>
        <div style={styles.live}>
          <span style={styles.liveDot} />
          MATERIA VIVA
        </div>
      </header>

      <div style={styles.fps}>FPS <strong>60</strong></div>

      <MateriaLogo
        amplitude={8}
        baseColor={0x120d0a}
        cameraDistance={1500}
        environmentIntensity={0.32}
        height="100vh"
        heatColor={[0.96, 0.31, 0.11]}
        heatEmissive={[1, 0.28, 0.04]}
        heatEmissiveStrength={5.2}
        heatTintStrength={2.65}
        lights={MATERIA_BRASA_LIGHTS}
        material={{
          clearcoat: 0.42,
          clearcoatRoughness: 0.34,
          reflectivity: 0.1,
          roughness: 0.42,
        }}
        preset="brasa"
        style={styles.canvasTouch}
        toneMappingExposure={1.08}
        transparentBackground
      />

      <p style={styles.caption}>
        MOVÉ EL CURSOR O TOCÁ Y ARRASTRÁ LA{' '}
        <span style={styles.pulseText}>MATERIA</span>. ACTIVÁ MOVIMIENTO EN MÓVIL.
      </p>

      {motionState !== 'hidden' && (
        <button
          disabled={motionState === 'active' || motionState === 'requesting'}
          onClick={activateMotion}
          style={{
            ...styles.motionButton,
            ...(motionState === 'active' ? styles.motionButtonActive : null),
          }}
          type="button"
        >
          {motionState === 'active'
            ? 'MOVIMIENTO ACTIVO'
            : motionState === 'requesting'
              ? 'ACTIVANDO...'
              : motionState === 'denied'
                ? 'PERMISO DENEGADO'
                : 'ACTIVAR MOVIMIENTO'}
        </button>
      )}

      <aside style={styles.footer}>
        <div>STANDALONE PREVIEW · THREE.JS R160</div>
        <div>SIN BUILD · SIN DEV SERVER</div>
      </aside>
    </main>
  )
}

const styles = {
  main: {
    margin: 0,
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'relative' as const,
    background:
      'radial-gradient(circle at 18% 12%, rgba(244,78,28,0.18), transparent 28rem), radial-gradient(circle at 78% 18%, rgba(248,218,194,0.10), transparent 22rem), linear-gradient(180deg, #1C223A 0%, #11162A 58%, #0D1122 100%)',
    color: '#E5D4B6',
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
  },
  canvasTouch: {
    touchAction: 'none',
  },
  glowOne: {
    position: 'fixed' as const,
    inset: 'auto auto -22vmin -12vmin',
    width: '46vmin',
    height: '46vmin',
    borderRadius: '999px',
    background: 'rgba(244,78,28,0.18)',
    filter: 'blur(52px)',
    pointerEvents: 'none' as const,
  },
  glowTwo: {
    position: 'fixed' as const,
    inset: '-18vmin -12vmin auto auto',
    width: '40vmin',
    height: '40vmin',
    borderRadius: '999px',
    background: 'rgba(248,218,194,0.12)',
    filter: 'blur(58px)',
    pointerEvents: 'none' as const,
  },
  hud: {
    position: 'fixed' as const,
    top: 20,
    left: 20,
    zIndex: 10,
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.16em',
    lineHeight: 1.95,
    color: 'rgba(229,212,182,0.74)',
    pointerEvents: 'none' as const,
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    background: '#F1DEC8',
    color: '#11162A',
    marginBottom: 14,
    fontWeight: 800,
  },
  title: {
    color: '#E5D4B6',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  meta: { fontSize: 10, opacity: 0.82 },
  live: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    fontSize: 10,
    fontWeight: 800,
    color: 'rgba(229,212,182,0.76)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#F44E1C',
    boxShadow: '0 0 10px rgba(244,78,28,0.5)',
  },
  fps: {
    position: 'fixed' as const,
    top: 9,
    right: 20,
    zIndex: 10,
    color: 'rgba(229,212,182,0.58)',
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.16em',
    pointerEvents: 'none' as const,
  },
  caption: {
    position: 'fixed' as const,
    bottom: 70,
    left: '50%',
    zIndex: 10,
    width: 'min(520px, calc(100vw - 40px))',
    margin: 0,
    transform: 'translateX(-50%)',
    color: 'rgba(241,222,200,0.76)',
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.28,
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    pointerEvents: 'none' as const,
  },
  pulseText: {
    color: '#F44E1C',
  },
  motionButton: {
    position: 'fixed' as const,
    left: '50%',
    bottom: 118,
    zIndex: 12,
    transform: 'translateX(-50%)',
    border: '1px solid rgba(244,78,28,0.42)',
    borderRadius: 999,
    background: 'rgba(17,22,42,0.72)',
    boxShadow: '0 12px 34px rgba(0,0,0,0.28), 0 0 22px rgba(244,78,28,0.16)',
    color: '#F1DEC8',
    cursor: 'pointer',
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.16em',
    padding: '10px 14px',
    textTransform: 'uppercase' as const,
    WebkitBackdropFilter: 'blur(12px)',
    backdropFilter: 'blur(12px)',
  },
  motionButtonActive: {
    borderColor: 'rgba(244,78,28,0.72)',
    color: '#F44E1C',
  },
  footer: {
    position: 'fixed' as const,
    right: 20,
    bottom: 10,
    zIndex: 10,
    maxWidth: 360,
    color: 'rgba(229,212,182,0.40)',
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    lineHeight: 1.8,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
    pointerEvents: 'none' as const,
  },
} as const
