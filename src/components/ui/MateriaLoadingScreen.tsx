'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import styles from './MateriaLoadingScreen.module.css'

const MateriaLogo = dynamic(
  () => import('@/components/brand/MateriaLogo').then((mod) => mod.MateriaLogo),
  {
    ssr: false,
    loading: () => <div className={styles.materiaFallback} aria-hidden="true" />,
  }
)

interface Props {
  children: ReactNode
  badgeText?: string
  logoPlacement?: 'center' | 'left'
  waitDuration?: number
}

export function MateriaLoadingScreen({ 
  children, 
  badgeText = 'GONOVI . LINK',
  logoPlacement = 'center',
  waitDuration = 2500
}: Props) {
  const [phase, setPhase] = useState<'intro' | 'content'>('intro')
  const [fps, setFps] = useState(60)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (phase === 'intro') {
      interval = setInterval(() => {
        setFps(60 - Math.floor(Math.random() * 3))
      }, 500)
    }
    const timer = setTimeout(() => {
      setPhase('content')
    }, waitDuration)
    return () => {
      clearTimeout(timer)
      if (interval) clearInterval(interval)
    }
  }, [phase, waitDuration])

  return (
    <div className={styles.root} data-logo-placement={logoPlacement} data-phase={phase}>
      <div className={styles.introOverlay} aria-hidden="true" />
      
      <div className={styles.hud} aria-hidden="true">
        <div className={styles.hudBadge}>{badgeText}</div>
        <div className={styles.hudRow}>
          <div className={styles.hudDot} /> MATERIA VIVA
        </div>
      </div>

      <div className={styles.fps} aria-hidden="true">
        RENDERING <strong>{fps} FPS</strong>
      </div>

      <div className={styles.caption} aria-hidden="true">
        CARGANDO<span style={{ color: 'var(--primary)' }}>...</span>
      </div>

      <div className={styles.footerMeta} aria-hidden="true">
        GONOVI<br/>2026
      </div>

      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.shardOne} aria-hidden="true" />
      <div className={styles.shardTwo} aria-hidden="true" />
      <div className={styles.shardThree} aria-hidden="true" />

      <div className={styles.materiaWrapper} aria-hidden="true">
        <MateriaLogo
          amplitude={8}
          autoRotateIdle
          baseColor={0x120d0a}
          bloomIntensity={0.25}
          cameraDistance={phase === 'intro' ? 1400 : 2600}
          className={styles.materiaLogo}
          cursorTilt
          enableZoom={false}
          environmentIntensity={0.2}
          gyroscope
          globalPointerHeat
          heatColor={[0.98, 0.28, 0.08]}
          heatEmissive={[1, 0.24, 0.02]}
          heatEmissiveStrength={2.2}
          heatTintStrength={1.2}
          material={{ clearcoat: 0.35, clearcoatRoughness: 0.35, reflectivity: 0.1, roughness: 0.55 }}
          preset="brasa"
          svgUrl="/logo-gon-mark-3d.svg"
          toneMappingExposure={0.8}
          transparentBackground
        />
      </div>

      <div className={styles.contentLayer}>
        {children}
      </div>
    </div>
  )
}
