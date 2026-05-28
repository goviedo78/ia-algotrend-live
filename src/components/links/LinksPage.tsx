'use client'

import dynamic from 'next/dynamic'
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

        <aside className={styles.sponsorBanner} aria-label="Información para patrocinadores">
          <p className={styles.sponsorPitch}>{SPONSOR.pitch}</p>
          <p className={styles.sponsorDesc}>{SPONSOR.description}</p>
          <a className={styles.sponsorCta} href={SPONSOR.ctaHref}>
            {SPONSOR.ctaText}
          </a>
        </aside>

        <ul className={styles.list}>
          {LINKS.map((link) => {
            const isExternal = link.external !== false && /^https?:\/\//.test(link.href)
            return (
              <li key={link.title} className={styles.linkItem}>
                <a
                  href={link.href}
                  className={styles.linkBtn}
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
