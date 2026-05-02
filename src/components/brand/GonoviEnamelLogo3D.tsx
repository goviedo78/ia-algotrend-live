'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'

const SELECTED_LOGO_SRC = '/logo-elegant-triads/05-ink-bone-pulse.svg'

interface GonoviEnamelLogo3DProps {
  size?: number | string
  compact?: boolean
  interactive?: boolean
  className?: string
}

export function GonoviEnamelLogo3D({
  size = 420,
  compact = false,
  className = '',
}: GonoviEnamelLogo3DProps) {
  const cssSize = typeof size === 'number' ? `${size}px` : size
  const style = { '--logo-size': cssSize } as CSSProperties

  return (
    <div
      aria-label="GONOVI logo"
      className={`gonovi-logo-scene ${compact ? 'is-compact' : ''} ${className}`}
      role="img"
      style={style}
    >
      <Image
        alt=""
        className="gonovi-logo-image"
        height={900}
        priority
        src={SELECTED_LOGO_SRC}
        width={900}
      />

      <style jsx>{`
        .gonovi-logo-scene {
          width: var(--logo-size);
          height: var(--logo-size);
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 999px;
          isolation: isolate;
          background: #1c223a;
          box-shadow:
            0 0 0 1px rgba(248, 218, 194, 0.18),
            0 18px 42px rgba(0, 0, 0, 0.32),
            0 0 32px rgba(244, 78, 28, 0.18);
        }

        :global(.gonovi-logo-image) {
          width: 100%;
          height: 100%;
          display: block;
          border-radius: 999px;
          user-select: none;
          -webkit-user-drag: none;
        }

        .gonovi-logo-scene.is-compact {
          box-shadow:
            0 0 0 1px rgba(248, 218, 194, 0.18),
            0 0 14px rgba(244, 78, 28, 0.24);
        }
      `}</style>
    </div>
  )
}

export default GonoviEnamelLogo3D
