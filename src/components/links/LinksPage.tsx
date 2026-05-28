'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import {
  HEADER as DEFAULT_HEADER,
  LINKS as DEFAULT_LINKS,
  ECOSYSTEM_LABEL as DEFAULT_ECOSYSTEM,
  COPYRIGHT as DEFAULT_COPYRIGHT,
  SPONSOR as DEFAULT_SPONSOR,
  type LinkItem,
} from './linksData'
import { LinkIcon } from './LinkIcon'
import styles from './LinksPage.module.css'

type LinksConfigShape = {
  header: typeof DEFAULT_HEADER
  sponsor: typeof DEFAULT_SPONSOR
  links: LinkItem[]
  ecosystemLabel: string
  copyright: string
}

const MateriaLogo = dynamic(
  () => import('@/components/brand/MateriaLogo').then((mod) => mod.MateriaLogo),
  {
    ssr: false,
    loading: () => <div className={styles.materiaFallback} aria-hidden="true" />,
  }
)

export function LinksPage({ config }: { config?: LinksConfigShape } = {}) {
  const HEADER = config?.header ?? DEFAULT_HEADER
  const LINKS = config?.links ?? DEFAULT_LINKS
  const ECOSYSTEM_LABEL = config?.ecosystemLabel ?? DEFAULT_ECOSYSTEM
  const COPYRIGHT = config?.copyright ?? DEFAULT_COPYRIGHT
  const SPONSOR = config?.sponsor ?? DEFAULT_SPONSOR
  
  const [phase, setPhase] = useState<'intro' | 'content'>('intro')
  const [fps, setFps] = useState(60)
  
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (phase === 'intro') {
      interval = setInterval(() => {
        setFps(60 - Math.floor(Math.random() * 3)) // Simula 58-60 fps fluctuantes
      }, 500)
    }
    const timer = setTimeout(() => {
      setPhase('content')
    }, 2500) // 2.5s intro
    return () => {
      clearTimeout(timer)
      if (interval) clearInterval(interval)
    }
  }, [phase])

  useEffect(() => {
    const el = document.getElementById('scroll-sentinel')
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      setIsScrolled(!entry.isIntersecting)
    }, { threshold: 0, rootMargin: '-20px 0px 0px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <main className={styles.main} data-phase={phase}>
      <div className={styles.introOverlay} aria-hidden="true" />
      
      {/* ── HUD de Intro ── */}
      <div className={styles.hud} aria-hidden="true">
        <div className={styles.hudBadge}>GONOVI . LINK</div>
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

      {/* ── 3D Logo Background ── */}
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

      <div className={styles.container}>
        <div id="scroll-sentinel" style={{ position: 'absolute', top: 0, height: '1px', width: '100%', pointerEvents: 'none' }} aria-hidden="true" />
        
        {/* ── Top Bar (Sticky with Collapse) ── */}
        <aside className={`${styles.topBar} ${isScrolled ? styles.scrolled : ''}`} aria-label="Información para patrocinadores">
          <div className={styles.topBarTopRow}>
            <div className={styles.topBarBrand}>
              <Image
                src="/logo-orange-graphite-navy/01-navy-cream-orange-transparent.svg"
                alt="GONOVI"
                width={32}
                height={32}
                priority
              />
              <span>GONOVI</span>
            </div>
            <a className={styles.sponsorCta} href={SPONSOR.ctaHref}>
              {SPONSOR.ctaText}
            </a>
          </div>
          
          <div className={styles.topBarExpandedContent}>
            <p className={styles.sponsorPitch}>{SPONSOR.pitch}</p>
            <p className={styles.sponsorDesc}>{SPONSOR.description}</p>
          </div>
        </aside>

        <header className={styles.header}>
          <h1 className={styles.brand}>{HEADER.brand}</h1>
          {HEADER.subtitle && <p className={styles.subtitle}>{HEADER.subtitle}</p>}
        </header>

        <ul className={styles.list}>
          {LINKS.filter(link => !link.hidden).map((link) => {
            const isExternal = link.external !== false && /^https?:\/\//.test(link.href)
            // Asignamos el color dinámico como variable CSS para que el módulo lo use
            const customStyle = link.color ? { '--brand-color': link.color } as React.CSSProperties : {}
            
            return (
              <li key={link.title} className={styles.linkItem}>
                <a
                  href={link.href}
                  className={styles.linkBtn}
                  style={customStyle}
                  {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
                  aria-label={link.badge ? `${link.title} (${link.badge})` : link.title}
                >
                  {link.icon && (
                    <span className={styles.linkIcon}>
                      <LinkIcon name={link.icon} />
                    </span>
                  )}
                  <span className={styles.linkTitle}>{link.title}</span>
                  {link.badge && <span className={styles.badge}>{link.badge}</span>}
                </a>
              </li>
            )
          })}
        </ul>

        <p className={styles.ecosystem}>{ECOSYSTEM_LABEL}</p>
        <p className={styles.footer}>{COPYRIGHT}</p>
      </div>
    </main>
  )
}
