'use client'

import { MateriaLogo } from '@/components/brand/MateriaLogo'

export default function MateriaPage() {
  return (
    <main style={styles.main}>
      <MateriaLogo height="100vh" />

      <header style={styles.hud}>
        <span style={styles.badge}>GON · Concepto 3</span>
        <div style={styles.title}>Materia</div>
        <div style={styles.meta}>R3F · MeshPhysicalMaterial · simplex 3D</div>
      </header>

      <p style={styles.caption}>
        Mové el cursor para perturbar la <span style={styles.pulseText}>materia</span>.
        Click sostenido la calma.
      </p>

      <aside style={styles.footer}>
        Componente React · src/components/brand/MateriaLogo.tsx
      </aside>
    </main>
  )
}

const styles = {
  main: {
    margin: 0,
    padding: 0,
    background: 'oklch(15% 0.012 60)',
    color: 'oklch(96% 0.008 80)',
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  hud: {
    position: 'fixed' as const,
    top: 32,
    left: 32,
    zIndex: 10,
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    lineHeight: 1.8,
    color: 'oklch(78% 0.008 60)',
    pointerEvents: 'none' as const,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    background: 'oklch(96% 0.008 80)',
    color: 'oklch(15% 0.012 60)',
    marginBottom: 12,
    letterSpacing: '0.12em',
  },
  title: { color: 'oklch(96% 0.008 80)', fontSize: 13, fontWeight: 600 },
  meta: { fontSize: 10, opacity: 0.7 },
  caption: {
    position: 'fixed' as const,
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center' as const,
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase' as const,
    color: 'oklch(78% 0.008 60)',
    pointerEvents: 'none' as const,
    margin: 0,
  },
  pulseText: { color: 'oklch(62% 0.18 28)' },
  footer: {
    position: 'fixed' as const,
    bottom: 32,
    right: 32,
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'oklch(55% 0.010 60)',
    textAlign: 'right' as const,
    pointerEvents: 'none' as const,
  },
} as const
