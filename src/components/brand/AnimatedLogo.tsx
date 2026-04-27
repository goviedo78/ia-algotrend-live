'use client'

/**
 * AnimatedLogo · GON brand
 * Concepto A — "Inscripción"
 *
 * Firma cinética del emblema GON. Reveal radial desde las 12 horas (sentido
 * horario) vía conic-gradient mask + settle de escala + micro-pulse central.
 *
 * Estados:
 *   - 'enter'   reveal completo, una sola vez
 *   - 'idle'    estado de reposo, respira en hover
 *   - 'loading' reveal pausado al 88-96% en loop hasta cambiar a 'idle'
 *
 * Uso:
 *   <AnimatedLogo />
 *   <AnimatedLogo size={120} color="ink" />
 *   <AnimatedLogo state={isLoaded ? 'idle' : 'loading'} />
 */

import { motion } from 'motion/react'
import { useState, type CSSProperties } from 'react'

type LogoColor = 'bone' | 'ink' | 'bronze'
type LogoState = 'enter' | 'idle' | 'loading'

export interface AnimatedLogoProps {
  /** Tamaño en px del lado (cuadrado). Default 200 */
  size?: number
  /** Color del trazo del emblema. Default 'bone' */
  color?: LogoColor
  /** Estado de la animación. Default 'enter' */
  state?: LogoState
  /** URL del SVG del emblema. Default '/logo-gon.svg' */
  src?: string
  /** Clase CSS adicional */
  className?: string
}

const COLORS: Record<LogoColor, string> = {
  bone:   'oklch(96% 0.008 80)',
  ink:    'oklch(15% 0.012 60)',
  bronze: 'oklch(58% 0.085 65)',
}

const ENTRY_EASE  = [0.16, 1, 0.3, 1] as const  // ease-out-quint
const BREATH_EASE = [0.45, 0, 0.55, 1] as const // ease-in-out-quint

// Hoisted module-level styles. @keyframes and @property are global, so we
// inject them once and all instances share. No per-instance ID juggling.
const GLOBAL_STYLES = `
  @property --gon-reveal {
    syntax: '<percentage>';
    inherits: false;
    initial-value: 0%;
  }
  @keyframes gon-reveal-enter {
    0%   { --gon-reveal: 0%; }
    100% { --gon-reveal: 100%; }
  }
  @keyframes gon-reveal-loading {
    0%, 100% { --gon-reveal: 88%; }
    50%      { --gon-reveal: 96%; }
  }
  .gon-mask {
    -webkit-mask-image: conic-gradient(from -90deg, black var(--gon-reveal, 100%), transparent var(--gon-reveal, 100%));
            mask-image: conic-gradient(from -90deg, black var(--gon-reveal, 100%), transparent var(--gon-reveal, 100%));
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    will-change: mask-image;
  }
  .gon-mask--enter   { animation: gon-reveal-enter   1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .gon-mask--loading { animation: gon-reveal-loading 2400ms cubic-bezier(0.45, 0, 0.55, 1) infinite; }

  /* Sheen interno: highlight blanco fuerte arriba-izq + sombra dura abajo-der.
     Sin mix-blend-mode — pinta directo para máxima visibilidad sobre Bone. */
  .gon-sheen {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 38%),
      linear-gradient(135deg, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.55) 100%);
    -webkit-mask-size: 100% 100%;
            mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    pointer-events: none;
    opacity: 0;
  }
  .gon-sheen--enter { animation: gon-sheen-fade 800ms cubic-bezier(0.16, 1, 0.3, 1) 1100ms forwards; }
  .gon-sheen--idle  { opacity: 1; }
  @keyframes gon-sheen-fade { to { opacity: 1; } }
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const tag = document.createElement('style')
  tag.dataset.gonStyles = ''
  tag.textContent = GLOBAL_STYLES
  document.head.appendChild(tag)
  stylesInjected = true
}

export function AnimatedLogo({
  size = 200,
  color = 'bone',
  state = 'enter',
  src = '/logo-gon.svg',
  className = '',
}: AnimatedLogoProps) {
  // Inject the global stylesheet once on first render of any instance.
  ensureStyles()

  // Track whether the entry reveal has finished — gates hover breath.
  // Lazy init: 'enter' starts not-revealed, anything else starts revealed.
  const [revealed, setRevealed] = useState(() => state !== 'enter')

  const fg = COLORS[color]
  const isEntering = state === 'enter'
  const isLoading  = state === 'loading'

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    position: 'relative',
    display: 'inline-block',
    // Glow cálido + sombra de contacto. Sobre fondo dark la sombra negra
    // pura es invisible, así que añadimos halo orange muy sutil.
    filter:
      'drop-shadow(0 0 36px rgba(255, 138, 60, 0.18)) ' +
      'drop-shadow(0 16px 28px rgba(0, 0, 0, 0.55))',
  }

  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    // SVG consumes these vars (see public/logo-gon.svg)
    ['--logo-bg' as string]: 'transparent',
    ['--logo-fg' as string]: fg,
  }

  const sheenStyle: CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
  }

  const maskClass =
    'gon-mask' +
    (isLoading ? ' gon-mask--loading' : isEntering ? ' gon-mask--enter' : '')

  const sheenClass =
    'gon-sheen' +
    (isLoading ? '' : isEntering ? ' gon-sheen--enter' : ' gon-sheen--idle')

  return (
    // Outer layer: one-shot settle scale on entry. Stays at scale 1 forever.
    <motion.div
      className={className}
      style={containerStyle}
      initial={isEntering ? { scale: 0.96 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 1.4, ease: ENTRY_EASE }}
      onAnimationComplete={() => {
        if (isEntering) setRevealed(true)
      }}
    >
      {/* Inner layer: hover breath. Decoupled so the entry settle never replays. */}
      <motion.div
        style={{ width: '100%', height: '100%', position: 'relative' }}
        whileHover={
          revealed && !isLoading
            ? { scale: [1, 1.015, 1] }
            : undefined
        }
        transition={{ duration: 1.8, ease: BREATH_EASE, repeat: Infinity }}
      >
        <img className={maskClass} src={src} alt="GON" style={imgStyle} />
        <div className={sheenClass} style={sheenStyle} aria-hidden />
      </motion.div>

      {/* Center micro-pulse. Single shot, only on first entry. */}
      {isEntering && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: fg,
            translateX: '-50%',
            translateY: '-50%',
            pointerEvents: 'none',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 2.5], opacity: [0, 0.6, 0] }}
          transition={{
            duration: 0.6,
            ease: ENTRY_EASE,
            delay: 1.3,
            times: [0, 0.4, 1],
          }}
        />
      )}
    </motion.div>
  )
}

export default AnimatedLogo
