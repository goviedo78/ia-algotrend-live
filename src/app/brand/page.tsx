'use client'

import { useState } from 'react'
import { AnimatedLogo } from '@/components/brand/AnimatedLogo'

type LogoState = 'enter' | 'idle' | 'loading'

export default function BrandPage() {
  const [state, setState] = useState<LogoState>('enter')
  const [key, setKey]     = useState(0)

  const replay = () => {
    setState('enter')
    setKey((k) => k + 1)
  }

  return (
    <main style={styles.main}>
      <header style={styles.hud}>
        <span style={styles.badge}>GON · Concepto A</span>
        <div style={styles.hudTitle}>Inscripción</div>
        <div style={styles.hudMeta}>1400ms · ease-out-quint · Framer Motion</div>
        <div style={styles.hudRow}>
          <span style={styles.dot} />
          <span>{state === 'loading' ? 'Cargando…' : 'Reposo'}</span>
        </div>
      </header>

      <section style={styles.stage}>
        {/* key forces remount when replaying */}
        <AnimatedLogo key={key} state={state} size={420} color="bone" />
        <p style={styles.caption}>
          Pasá el cursor para ver la <span style={styles.pulseText}>respiración</span> idle
        </p>
      </section>

      <nav style={styles.controls}>
        <button
          style={{ ...styles.btn, ...(state === 'enter'   ? styles.btnActive : {}) }}
          onClick={replay}
        >
          Replay
        </button>
        <button
          style={{ ...styles.btn, ...(state === 'loading' ? styles.btnActive : {}) }}
          onClick={() => setState('loading')}
        >
          Loading
        </button>
        <button
          style={{ ...styles.btn, ...(state === 'idle'    ? styles.btnActive : {}) }}
          onClick={() => setState('idle')}
        >
          Idle
        </button>
      </nav>

      <aside style={styles.footer}>
        Production component · src/components/brand/AnimatedLogo.tsx
      </aside>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100vh',
    background: 'oklch(15% 0.012 60)',
    color: 'oklch(96% 0.008 80)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    position: 'relative' as const,
  },
  hud: {
    position: 'fixed' as const,
    top: 32,
    left: 32,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    lineHeight: 1.8,
    color: 'oklch(78% 0.008 60)',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    background: 'oklch(96% 0.008 80)',
    color: 'oklch(15% 0.012 60)',
    marginBottom: 12,
    letterSpacing: '0.12em',
  },
  hudTitle: { color: 'oklch(96% 0.008 80)', fontSize: 13, fontWeight: 600 },
  hudMeta:  { fontSize: 10, opacity: 0.7 },
  hudRow:   { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'oklch(62% 0.18 28)',
  },
  stage: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 56,
  },
  caption: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase' as const,
    color: 'oklch(78% 0.008 60)',
    margin: 0,
  },
  pulseText: { color: 'oklch(62% 0.18 28)' },
  controls: {
    position: 'fixed' as const,
    bottom: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 1,
    background: 'oklch(35% 0.011 60)',
    border: '1px solid oklch(35% 0.011 60)',
  },
  btn: {
    background: 'oklch(15% 0.012 60)',
    color: 'oklch(96% 0.008 80)',
    border: 0,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '12px 20px',
    cursor: 'pointer',
    transition: 'background 200ms ease, color 200ms ease',
  },
  btnActive: {
    background: 'oklch(62% 0.18 28)',
    color: 'oklch(96% 0.008 80)',
  },
  footer: {
    position: 'fixed' as const,
    bottom: 32,
    right: 32,
    fontFamily: 'ui-monospace, monospace',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'oklch(55% 0.010 60)',
    textAlign: 'right' as const,
  },
} as const
