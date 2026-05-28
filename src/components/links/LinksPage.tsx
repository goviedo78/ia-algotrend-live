'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { HEADER, LINKS, ECOSYSTEM_LABEL, COPYRIGHT, SPONSOR } from './linksData'
import { LinkIcon } from './LinkIcon'
import styles from './LinksPage.module.css'

const MateriaLogo = dynamic(
  () => import('@/components/brand/MateriaLogo').then((mod) => mod.MateriaLogo),
  {
    ssr: false,
    loading: () => <div className={styles.materiaFallback} aria-hidden="true" />,
  }
)

export function LinksPage() {
  const [phase, setPhase] = useState<'intro' | 'content'>('intro')

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('content')
    }, 2500) // 2.5s intro
    return () => clearTimeout(timer)
  }, [])

  return (
    <main className={styles.main} data-phase={phase}>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.shardOne} aria-hidden="true" />
      <div className={styles.shardTwo} aria-hidden="true" />
      <div className={styles.shardThree} aria-hidden="true" />

      {/* ── Top Bar (Sticky edge with Logo and CTA) ── */}
      <aside className={styles.topBar} aria-label="Navegación principal">
        <div className={styles.topBarInner}>
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
      </aside>

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
        <header className={styles.header}>
          <h1 className={styles.brand}>{HEADER.brand}</h1>
          <p className={styles.subtitle}>{HEADER.subtitle}</p>
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
