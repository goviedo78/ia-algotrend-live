/**
 * GON · Motion System v1
 *
 * Curva canónica: inOutExpo. Disponible en CSS via --gon-ease-expo
 * (linear() polyline en globals.css) y acá en JS para Framer Motion / anime.js.
 *
 * Filosofía:
 *   - CSS para idles infinitos (respiración, pulse, shimmer)
 *   - Framer Motion para entry/exit/state transitions
 *   - anime.js solo si aparece un caso timeline-heavy
 *
 * Las constantes de duración/easing acá DEBEN coincidir con las de
 * globals.css → cualquier cambio se hace en los dos lados.
 */

// ── Easings ──────────────────────────────────────────────────────────────────

/** inOutExpo aproximado en cubic-bezier — para Framer Motion / CSS transition. */
export const gonEaseExpo = [0.87, 0, 0.13, 1] as const

/** ease-out-quint, default GON. Para entries y state transitions ligeras. */
export const gonEaseOut = [0.16, 1, 0.3, 1] as const

/** ease-out-quart, agresivo. Para reveal y micro-interactions. */
export const gonEaseOutFast = [0.22, 1, 0.36, 1] as const

/** Simétrico, breath/loop. */
export const gonEaseInOut = [0.45, 0, 0.55, 1] as const

/** Lento, dramático — entries de hero, transiciones cinematográficas. */
export const gonEaseCinema = [0.83, 0, 0.17, 1] as const

/** Nombre canónico para anime.js (que acepta strings). */
export const gonEaseExpoName = 'inOutExpo' as const

// ── Durations ────────────────────────────────────────────────────────────────

export const gonDur = {
  quick:   0.4,
  normal:  0.7,
  slow:    1.2,
  breath:  4.5,
  cinema:  2.4,
} as const

// ── Variants Framer Motion reusables ─────────────────────────────────────────

/** Entry desde abajo con fade. La default GON para revealar contenido. */
export const gonFadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: gonDur.normal, ease: gonEaseOutFast },
}

/** Entry desde abajo más dramática — para hero / títulos. */
export const gonFadeUpCinema = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: gonDur.slow, ease: gonEaseExpo },
}

/** Stagger container — los hijos aparecen escalonados. */
export const gonStagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

/** Hover lift sutil para tarjetas / botones glass. */
export const gonHoverLift = {
  whileHover: { y: -2, transition: { duration: gonDur.quick, ease: gonEaseOut } },
  whileTap:   { y: 0, scale: 0.98 },
}
