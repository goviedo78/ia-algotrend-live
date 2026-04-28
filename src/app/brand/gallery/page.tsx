'use client'

/**
 * GON Brand · Gallery
 * Muestra las 6 alternativas visuales del emblema lado a lado.
 * Cada celda es un canvas R3F independiente. Pesado en GPU; mover el cursor
 * sobre cualquiera activa su tilt y heat tint.
 */

import { useState } from 'react'
import { MateriaLogo, PRESETS, type PresetName } from '@/components/brand/MateriaLogo'

const PRESET_META: Record<PresetName, { label: string; subtitle: string }> = {
  brasa:     { label: 'Brasa',     subtitle: 'Naranja quemado glow' },
  plata:     { label: 'Plata',     subtitle: 'Chrome técnico' },
  cobre:     { label: 'Cobre',     subtitle: 'Metal cálido clásico' },
  obsidiana: { label: 'Obsidiana', subtitle: 'Negro con eléctrico azul' },
  magma:     { label: 'Magma',     subtitle: 'Lava roja agresiva' },
  hielo:     { label: 'Hielo',     subtitle: 'Frosted azul-blanco' },
}

const PRESET_NAMES = Object.keys(PRESETS) as PresetName[]

export default function GalleryPage() {
  const [focused, setFocused] = useState<PresetName | null>(null)

  return (
    <main style={styles.main}>
      <header style={styles.hud}>
        <span style={styles.badge}>GON · Gallery</span>
        <div style={styles.title}>6 alternativas visuales</div>
        <div style={styles.meta}>Misma geometría · materiales y luces distintos</div>
      </header>

      {/* Vista detalle (uno grande) o grid (los 6) */}
      {focused ? (
        <section style={styles.detailView}>
          <button onClick={() => setFocused(null)} style={styles.backBtn}>
            ← Volver al grid
          </button>
          <div style={styles.detailLabel}>
            <span style={styles.detailName}>{PRESET_META[focused].label}</span>
            <span style={styles.detailSubtitle}>{PRESET_META[focused].subtitle}</span>
          </div>
          <div style={styles.detailCanvas}>
            <MateriaLogo
              key={focused}
              preset={focused}
              height="100%"
              cameraDistance={1500}
            />
          </div>
        </section>
      ) : (
        <section style={styles.grid}>
          {PRESET_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => setFocused(name)}
              style={styles.cell}
            >
              <div style={styles.cellCanvas}>
                <MateriaLogo
                  preset={name}
                  height="100%"
                  cameraDistance={1700}
                  amplitude={6}
                  entryAnimation={false}
                  enableZoom={false}
                  gyroscope={false}
                  idleDelay={1.5}
                />
              </div>
              <div style={styles.cellLabel}>
                <span style={styles.cellName}>{PRESET_META[name].label}</span>
                <span style={styles.cellSubtitle}>{PRESET_META[name].subtitle}</span>
              </div>
            </button>
          ))}
        </section>
      )}

      <aside style={styles.footer}>
        Click una alternativa para verla en grande · /brand/gallery
      </aside>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100vh',
    background: 'oklch(15% 0.012 60)',
    color: 'oklch(96% 0.008 80)',
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    padding: 0,
    margin: 0,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  hud: {
    position: 'fixed' as const,
    top: 24,
    left: 24,
    zIndex: 10,
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    lineHeight: 1.7,
    color: 'oklch(78% 0.008 60)',
    pointerEvents: 'none' as const,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    background: 'oklch(96% 0.008 80)',
    color: 'oklch(15% 0.012 60)',
    marginBottom: 8,
    letterSpacing: '0.12em',
  },
  title: { color: 'oklch(96% 0.008 80)', fontSize: 13, fontWeight: 600 },
  meta:  { fontSize: 10, opacity: 0.7 },

  // GRID 3×2
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    width: '100vw',
    height: '100vh',
    gap: 1,
    background: 'oklch(35% 0.011 60)',
  },
  cell: {
    background: 'oklch(15% 0.012 60)',
    border: 0,
    cursor: 'pointer',
    padding: 0,
    position: 'relative' as const,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  cellCanvas: { flex: 1, position: 'relative' as const, minHeight: 0 },
  cellLabel: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    background: 'linear-gradient(to top, oklch(15% 0.012 60), transparent)',
    display: 'flex',
    flexDirection: 'column' as const,
    pointerEvents: 'none' as const,
  },
  cellName: {
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'oklch(96% 0.008 80)',
    textTransform: 'uppercase' as const,
  },
  cellSubtitle: {
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'oklch(78% 0.008 60)',
    marginTop: 2,
  },

  // DETAIL
  detailView: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
  },
  detailCanvas: {
    width: '100vw',
    height: '100vh',
  },
  detailLabel: {
    position: 'fixed' as const,
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    pointerEvents: 'none' as const,
  },
  detailName: {
    fontFamily: 'var(--gon-font-display, system-ui, sans-serif)',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'oklch(96% 0.008 80)',
    textTransform: 'uppercase' as const,
  },
  detailSubtitle: {
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: 'oklch(78% 0.008 60)',
    marginTop: 4,
  },
  backBtn: {
    position: 'fixed' as const,
    top: 24,
    right: 24,
    zIndex: 10,
    background: 'oklch(96% 0.008 80)',
    color: 'oklch(15% 0.012 60)',
    border: 0,
    padding: '8px 14px',
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  footer: {
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    zIndex: 10,
    fontFamily: 'var(--gon-font-mono, ui-monospace, monospace)',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'oklch(55% 0.010 60)',
    pointerEvents: 'none' as const,
  },
} as const
