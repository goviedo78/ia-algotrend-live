'use client'

import { useEffect } from 'react'
import type { LinkItem } from './linksData'
import type { CustomIcon } from '@/lib/links-config'
import { IconDisplay } from './IconDisplay'
import styles from './LinkSheet.module.css'

interface Props {
  link: LinkItem | null
  customIcons?: CustomIcon[]
  onClose: () => void
}

function getContrastColor(hex?: string) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return '#11162a'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return yiq >= 160 ? '#11162a' : '#ffffff'
}

export function LinkSheet({ link, customIcons, onClose }: Props) {
  // Cerrar con Escape
  useEffect(() => {
    if (!link) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    // Bloquear scroll del body mientras está abierto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [link, onClose])

  const open = link !== null
  const isExternal = link && link.external !== false && /^https?:\/\//.test(link.href)

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={link ? `Preview de ${link.title}` : 'Preview de link'}
    >
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <div
        className={styles.sheet}
        // Stop propagation para que click adentro no cierre
        onClick={(e) => e.stopPropagation()}
        style={link?.color ? { 
          '--brand-color': link.color,
          '--brand-text': getContrastColor(link.color)
        } as React.CSSProperties : undefined}
      >
        <div className={styles.handle} aria-hidden="true" />

        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Cerrar"
        >
          ✕
        </button>

        {link && (
          <>
            <div className={styles.iconWrap} style={{ color: link.color ?? 'var(--foreground)' }}>
              {link.icon ? (
                <IconDisplay name={link.icon} customIcons={customIcons} />
              ) : (
                <span className={styles.iconFallback} aria-hidden="true">→</span>
              )}
            </div>

            <h2 className={styles.title}>
              {link.title}
              {link.badge && <span className={styles.badge}>{link.badge}</span>}
            </h2>

            {link.description && (
              <p className={styles.description}>{link.description}</p>
            )}

            <p className={styles.urlPreview} title={link.href}>
              {link.href}
            </p>

            <a
              className={styles.cta}
              href={link.href}
              {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
              onClick={() => {
                // Pequeño delay para que se vea la animación de tap antes de cerrar
                setTimeout(onClose, 200)
              }}
            >
              Abrir →
            </a>
          </>
        )}
      </div>
    </div>
  )
}
