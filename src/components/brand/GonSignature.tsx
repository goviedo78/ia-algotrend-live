'use client'

/**
 * GonSignature
 * Firma de autoría sutil. Indica que el producto está construido por GON
 * sin invadir la identidad del producto host. Diseñada para vivir en el
 * footer o esquina inferior de cualquier pantalla.
 *
 * Uso:
 *   <GonSignature />                     // default: "Built by GON" + emblem
 *   <GonSignature label="By GON" />      // texto custom
 *   <GonSignature variant="compact" />   // solo emblema, sin texto
 *   <GonSignature href="/brand" />       // link al /brand (default)
 *
 * Respeta brand-tokens.css. Hover usa Pulse según el sistema GON.
 */

import Link from 'next/link'
import type { CSSProperties } from 'react'

type Variant = 'full' | 'compact'

export interface GonSignatureProps {
  label?: string
  href?: string | null
  variant?: Variant
  /** Tamaño del emblema en px. Default 16 */
  size?: number
  className?: string
  style?: CSSProperties
}

export function GonSignature({
  label   = 'Built by GON',
  href    = '/brand',
  variant = 'full',
  size    = 16,
  className = '',
  style,
}: GonSignatureProps) {
  const Inner = (
    <span
      className={'gon-signature ' + className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--gon-font-mono)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 'var(--gon-tracking-mono)',
        color: 'var(--gon-ink-60)',
        textDecoration: 'none',
        transition: 'color 200ms var(--gon-ease-out)',
        ...style,
      }}
    >
      <img
        src="/logo-gon-mark.svg"
        alt="GON"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          display: 'block',
          opacity: 0.7,
          transition: 'opacity 200ms var(--gon-ease-out)',
          // logo-gon-mark.svg uses currentColor as fallback
          color: 'currentColor',
        }}
      />
      {variant === 'full' && <span>{label}</span>}

      <style>{`
        .gon-signature:hover { color: var(--gon-pulse) !important; }
        .gon-signature:hover img { opacity: 1 !important; }
      `}</style>
    </span>
  )

  if (!href) return Inner
  return <Link href={href} aria-label={label}>{Inner}</Link>
}

export default GonSignature
