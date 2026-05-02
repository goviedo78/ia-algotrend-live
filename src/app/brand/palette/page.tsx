/**
 * GONOVI Palette v2 — Brief navegable
 * URL: /brand/palette
 *
 * Documenta la propuesta de paleta v2 (navy + cream + vivid + steel).
 * Auto-demostrativa: la página usa el palette v2 para mostrarlo en contexto.
 * Reemplaza el palette v1 warm-Ink que se aplicó en commits anteriores.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GONOVI · Palette v2 · Brief',
  description: 'Brief de la paleta v2: navy + cream + vivid + steel. Vintage Americana retro.',
}

// ── Tokens locales (mismos hex que brand-tokens.css) ─────────────────────────

const v2 = {
  // Principal
  ink:     '#1C223A',
  bone:    '#E5D4B6',
  bronze:  '#C9A87A',
  pulse:   '#F44E1C',
  steel:   '#3A3F4D',
  // Rampas
  inkDeep: '#11162A',
  ink20:   '#2A3148',
  ink30:   '#383F58',
  ink40:   '#4F5570',
  ink60:   '#6B7385',
  ink80:   '#A8AABA',
  bone90:  '#D8C8A6',
  bone80:  '#B8AB8E',
  pulse700:'#D43D10',
  pulse800:'#A82F08',
  // Trader semantic
  good:    '#4FBC72',
  goodDeep:'#1A3024',
  bad:     '#F44E1C',
  badDeep: '#301A1A',
} as const

const v1 = {
  ink:    '#1A1814',
  bone:   '#F4F1EA',
  bronze: '#A07A4C',
  pulse:  '#D8503C',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PalettePage() {
  return (
    <main style={s.main}>
      {/* HUD */}
      <header style={s.hud}>
        <span style={s.hudBadge}>GONOVI · Brief</span>
        <span style={s.hudMono}>Palette v2 · 2026.04</span>
      </header>

      {/* HERO */}
      <section style={s.hero}>
        <p style={s.eyebrow}>Propuesta · Sistema de marca v2</p>
        <h1 style={s.h1}>Navy + Cream + Vivid + Steel</h1>
        <p style={s.lead}>
          Dirección estética inspirada en{' '}
          <em style={s.italic}>vintage Americana retro</em> — poster Saul Bass, 50s editorial.
          Reemplaza el palette warm‑Ink (v1) por un sistema de contrastes alternados
          frío/cálido. Mismo ADN GONOVI, más punch, más memorable.
        </p>
      </section>

      {/* COMPARISON v1 → v2 */}
      <section style={s.section}>
        <SectionTitle eyebrow="01 · Antes y después" title="De warm‑Ink monocromático a navy + vivid" />
        <div style={s.comparisonGrid}>
          <ComparisonCard
            label="v1 · Warm Ink"
            colors={[v1.ink, v1.bone, v1.bronze, v1.pulse]}
            note="Coherente cálido pero monocromático. Sin contraste de temperatura."
            muted
          />
          <ComparisonCard
            label="v2 · Navy + Cream + Vivid"
            colors={[v2.ink, v2.bone, v2.bronze, v2.pulse]}
            note="Contraste frío (ink) + cálido (bone, pulse). Casi complementarios en rueda."
          />
        </div>
      </section>

      {/* PALETA PRINCIPAL */}
      <section style={s.section}>
        <SectionTitle eyebrow="02 · Paleta principal" title="4 colores + 1 neutro" />
        <div style={s.swatchGrid}>
          <Swatch name="Ink"     hex={v2.ink}    role="Surface · text on light" />
          <Swatch name="Bone"    hex={v2.bone}   role="Foreground · text on dark" textOnDark />
          <Swatch name="Bronze"  hex={v2.bronze} role="Premium accent · max 1 superficie" textOnDark />
          <Swatch name="Pulse"   hex={v2.pulse}  role="Cinético · CTA, hover, signal · max 5%" />
          <Swatch name="Steel"   hex={v2.steel}  role="Gris navy · separadores, surfaces neutros" />
        </div>
      </section>

      {/* RAMPAS */}
      <section style={s.section}>
        <SectionTitle eyebrow="03 · Rampas funcionales" title="Derivadas matemáticas, no son colores nuevos" />
        <div style={s.rampWrap}>
          <RampRow label="Ink scale" stops={[
            { hex: v2.inkDeep, name: 'deep',   role: 'app shell' },
            { hex: v2.ink,     name: 'ink',    role: 'panels' },
            { hex: v2.ink20,   name: '20',     role: 'raised' },
            { hex: v2.ink30,   name: '30',     role: 'mid' },
            { hex: v2.ink40,   name: '40',     role: 'borders' },
            { hex: v2.ink60,   name: '60',     role: 'dim text' },
            { hex: v2.ink80,   name: '80',     role: 'muted' },
          ]} />
          <RampRow label="Bone scale" stops={[
            { hex: v2.bone80, name: '80',  role: 'darker cream' },
            { hex: v2.bone90, name: '90',  role: 'cream tint' },
            { hex: v2.bone,   name: 'bone', role: 'text' },
          ]} />
          <RampRow label="Pulse scale" stops={[
            { hex: v2.pulse800, name: '800', role: 'deep' },
            { hex: v2.pulse700, name: '700', role: 'hover' },
            { hex: v2.pulse,    name: 'pulse', role: 'signal' },
          ]} />
        </div>
      </section>

      {/* TRADER SEMANTIC */}
      <section style={s.section}>
        <SectionTitle eyebrow="04 · Trader semantic" title="Verde / rojo ajustados al palette navy" />
        <div style={s.traderGrid}>
          <TraderSwatch
            label="Long · Win"
            hex={v2.good}
            bg={v2.goodDeep}
            note="Spring green readable on navy. Reemplaza al cool #22C55E del v1."
          />
          <TraderSwatch
            label="Short · Loss"
            hex={v2.bad}
            bg={v2.badDeep}
            note="= Pulse vivid #F44E1C. Doble función: signal y loss."
          />
        </div>
      </section>

      {/* USE RULES */}
      <section style={s.section}>
        <SectionTitle eyebrow="05 · Reglas de uso" title="No-negociables" />
        <ul style={s.rules}>
          <li style={s.rule}>
            <span style={s.ruleHash}>01</span>
            <strong>Pulse vivid en máximo 5% del área.</strong> Es energía pura — pierde
            efecto si se sobreusa. Reservar para CTAs, signals, hovers, accent hot text.
          </li>
          <li style={s.rule}>
            <span style={s.ruleHash}>02</span>
            <strong>Bronze gold es spice, no color principal.</strong> Solo warnings,
            trailing stop activo, highlights premium. Una superficie por composición.
          </li>
          <li style={s.rule}>
            <span style={s.ruleHash}>03</span>
            <strong>Steel vive entre Ink y Bone.</strong> Útil para separadores,
            dividers, surfaces que no son ni claros ni oscuros.
          </li>
          <li style={s.rule}>
            <span style={s.ruleHash}>04</span>
            <strong>Cream sobre navy = contraste óptimo.</strong> No usar cream sobre
            cream o navy sobre navy sin separación de luminance suficiente.
          </li>
          <li style={s.rule}>
            <span style={s.ruleHash}>05</span>
            <strong>Trader semantic mantiene convención universal.</strong> Verde para
            wins, rojo para losses. Pero ajustado al palette: spring green no SaaS-blue-green.
          </li>
          <li style={s.rule}>
            <span style={s.ruleHash}>06</span>
            <strong>Nunca #000 ni #fff.</strong> Tintar siempre — esa regla del v1
            sigue vigente.
          </li>
        </ul>
      </section>

      {/* MAPPING v1 → v2 */}
      <section style={s.section}>
        <SectionTitle eyebrow="06 · Mapping v1 → v2" title="Para migrar otros proyectos GONOVI" />
        <table style={s.mapTable}>
          <thead>
            <tr>
              <th style={s.mapTh}>Rol</th>
              <th style={s.mapTh}>v1 warm</th>
              <th style={s.mapTh}>v2 navy</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Ink (panels)',          '#1A1814', v2.ink],
              ['Ink-deep (body bg)',    '#0E0C09', v2.inkDeep],
              ['Ink-20 (raised)',       '#2A2620', v2.ink20],
              ['Ink-40 (borders)',      '#3D362A', v2.ink40],
              ['Ink-60 (dim)',          '#7A7468', v2.ink60],
              ['Ink-80 (muted)',        '#A8A39A', v2.ink80],
              ['Bone (foreground)',     '#F4F1EA', v2.bone],
              ['Pulse (signal)',        '#D8503C', v2.pulse],
              ['Pulse-700 (hover)',     '#B83E2C', v2.pulse700],
              ['Pulse-800 (deep)',      '#8E2E1F', v2.pulse800],
              ['Bronze (gold)',         '#A07A4C', v2.bronze],
              ['Good (win green)',      '#34D178', v2.good],
              ['—  Steel (NUEVO v2)',   '—',        v2.steel],
            ].map(([role, oldHex, newHex]) => (
              <tr key={role}>
                <td style={s.mapTd}>{role}</td>
                <td style={s.mapTd}>
                  {oldHex !== '—'
                    ? <SwatchInline hex={oldHex} />
                    : <span style={s.dashCell}>—</span>}
                </td>
                <td style={s.mapTd}><SwatchInline hex={newHex} highlight /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* DEMOS */}
      <section style={s.section}>
        <SectionTitle eyebrow="07 · Componentes en contexto" title="Cómo respira el palette en producto" />
        <div style={s.demoGrid}>
          {/* Demo: Card */}
          <DemoFrame label="Surface panel">
            <div style={s.demoPanel}>
              <p style={s.demoEyebrow}>Estado del motor</p>
              <h4 style={s.demoTitle}>Probabilidad alcista</h4>
              <p style={s.demoBig}>+72%</p>
              <div style={s.demoBar}>
                <div style={{ ...s.demoBarFill, width: '72%' }} />
              </div>
            </div>
          </DemoFrame>

          {/* Demo: CTA */}
          <DemoFrame label="CTA + Badges">
            <div style={s.demoStack}>
              <button style={s.demoBtn}>Activar alertas →</button>
              <div style={s.demoBadges}>
                <span style={s.demoBadge}>Live</span>
                <span style={{ ...s.demoBadge, ...s.demoBadgeLive }}>● Stream</span>
                <span style={{ ...s.demoBadge, ...s.demoBadgeDanger }}>● Sin conexión</span>
              </div>
              <p style={s.demoCaption}>
                Pulse vivido como signal · spring green como live state · ink-40 como neutral
              </p>
            </div>
          </DemoFrame>

          {/* Demo: Trade row */}
          <DemoFrame label="Trade row · live">
            <div style={s.demoTrade}>
              <div style={s.demoTradeLong}>
                <span style={s.demoBadgeLive}>● Largo abierto</span>
                <span style={s.demoTradeMeta}>@ $77,142 · SL $76,800 · TP $77,950</span>
                <span style={s.demoTradePnl}>+$208 (+0.27%)</span>
              </div>
              <div style={s.demoTradeShort}>
                <span style={s.demoBadgeDanger}>● Corto abierto</span>
                <span style={s.demoTradeMeta}>@ $77,142 · SL $77,500 · TP $76,400</span>
                <span style={{ ...s.demoTradePnl, color: v2.bad }}>−$84 (−0.11%)</span>
              </div>
            </div>
          </DemoFrame>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={s.footer}>
        <span>brand‑tokens.css · globals.css · src/components/*</span>
        <span style={s.footerSep}>·</span>
        <span>v2 vigente desde 2026.04</span>
      </footer>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={s.sectionTitle}>
      <p style={s.sectionEyebrow}>{eyebrow}</p>
      <h2 style={s.h2}>{title}</h2>
    </div>
  )
}

function ComparisonCard({
  label,
  colors,
  note,
  muted = false,
}: {
  label: string
  colors: string[]
  note: string
  muted?: boolean
}) {
  return (
    <div style={{ ...s.compCard, opacity: muted ? 0.55 : 1 }}>
      <p style={s.compLabel}>{label}</p>
      <div style={s.compStrip}>
        {colors.map((c) => (
          <div key={c} style={{ ...s.compSwatch, background: c }} />
        ))}
      </div>
      <p style={s.compNote}>{note}</p>
    </div>
  )
}

function Swatch({
  name,
  hex,
  role,
  textOnDark = false,
}: {
  name: string
  hex: string
  role: string
  textOnDark?: boolean
}) {
  return (
    <div style={s.swatchCard}>
      <div style={{ ...s.swatchBig, background: hex }}>
        <span style={{
          ...s.swatchHex,
          color: textOnDark ? v2.ink : v2.bone,
        }}>
          {hex}
        </span>
      </div>
      <div style={s.swatchMeta}>
        <p style={s.swatchName}>{name}</p>
        <p style={s.swatchRole}>{role}</p>
      </div>
    </div>
  )
}

function RampRow({
  label,
  stops,
}: {
  label: string
  stops: { hex: string; name: string; role: string }[]
}) {
  return (
    <div style={s.rampBlock}>
      <p style={s.rampLabel}>{label}</p>
      <div style={s.rampRow}>
        {stops.map((stop) => (
          <div key={stop.hex} style={s.rampStop}>
            <div style={{ ...s.rampSwatch, background: stop.hex }} />
            <p style={s.rampName}>{stop.name}</p>
            <p style={s.rampHex}>{stop.hex}</p>
            <p style={s.rampRole}>{stop.role}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TraderSwatch({
  label,
  hex,
  bg,
  note,
}: {
  label: string
  hex: string
  bg: string
  note: string
}) {
  return (
    <div style={{ ...s.traderCard, background: bg }}>
      <p style={s.traderLabel}>{label}</p>
      <p style={{ ...s.traderHex, color: hex }}>{hex}</p>
      <p style={s.traderNote}>{note}</p>
    </div>
  )
}

function SwatchInline({ hex, highlight = false }: { hex: string; highlight?: boolean }) {
  return (
    <span style={s.inlineWrap}>
      <span style={{ ...s.inlineSwatch, background: hex, outline: highlight ? `1px solid ${v2.pulse}` : `1px solid ${v2.ink40}` }} />
      <span style={{ ...s.inlineHex, color: highlight ? v2.bone : v2.ink80 }}>{hex}</span>
    </span>
  )
}

function DemoFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.demoFrame}>
      <p style={s.demoFrameLabel}>{label}</p>
      {children}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const FONT_DISPLAY = '"Space Grotesk", system-ui, -apple-system, sans-serif'
const FONT_TEXT    = '"Inter", system-ui, sans-serif'
const FONT_MONO    = '"JetBrains Mono", ui-monospace, monospace'

const s = {
  main: {
    minHeight: '100vh',
    background: `radial-gradient(circle at top, #1F2845, ${v2.inkDeep} 70%)`,
    color: v2.bone,
    fontFamily: FONT_TEXT,
    padding: '64px 24px 96px',
    position: 'relative' as const,
  },
  hud: {
    position: 'fixed' as const,
    top: 24,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontFamily: FONT_MONO,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    color: v2.ink80,
    zIndex: 10,
    background: `${v2.ink}cc`,
    backdropFilter: 'blur(10px)',
    padding: '8px 14px',
    borderRadius: 999,
    border: `1px solid ${v2.ink40}`,
  },
  hudBadge: {
    background: v2.bone,
    color: v2.ink,
    padding: '2px 8px',
    fontWeight: 600,
    letterSpacing: '0.14em',
  },
  hudMono: { color: v2.pulse },

  // ── Hero
  hero: {
    maxWidth: 920,
    margin: '0 auto 96px',
    paddingTop: 80,
  },
  eyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.pulse,
    margin: '0 0 16px',
  },
  h1: {
    fontFamily: FONT_DISPLAY,
    fontSize: 'clamp(40px, 6vw, 80px)',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    lineHeight: 1.02,
    margin: '0 0 24px',
    color: v2.bone,
  },
  lead: {
    fontFamily: FONT_TEXT,
    fontSize: 17,
    lineHeight: 1.55,
    color: v2.ink80,
    maxWidth: 720,
    margin: 0,
  },
  italic: { color: v2.bronze, fontStyle: 'italic' as const },

  // ── Section
  section: {
    maxWidth: 1200,
    margin: '0 auto 96px',
  },
  sectionTitle: {
    marginBottom: 32,
  },
  sectionEyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink80,
    margin: '0 0 8px',
  },
  h2: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: '-0.015em',
    color: v2.bone,
    margin: 0,
  },

  // ── Comparison
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: 16,
  },
  compCard: {
    background: `${v2.ink}cc`,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    padding: 24,
    transition: 'opacity 200ms ease',
  },
  compLabel: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink80,
    margin: '0 0 16px',
  },
  compStrip: {
    display: 'flex',
    gap: 0,
    borderRadius: 8,
    overflow: 'hidden',
    height: 64,
    border: `1px solid ${v2.ink40}`,
    marginBottom: 16,
  },
  compSwatch: { flex: 1 },
  compNote: {
    fontSize: 13,
    color: v2.ink80,
    lineHeight: 1.5,
    margin: 0,
  },

  // ── Swatch grid
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  swatchCard: {
    background: `${v2.ink}88`,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    overflow: 'hidden',
  },
  swatchBig: {
    height: 140,
    display: 'flex',
    alignItems: 'flex-end',
    padding: 16,
  },
  swatchHex: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    letterSpacing: '0.05em',
    fontWeight: 500,
  },
  swatchMeta: { padding: '14px 16px 18px' },
  swatchName: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    fontSize: 18,
    letterSpacing: '-0.01em',
    color: v2.bone,
    margin: '0 0 4px',
  },
  swatchRole: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: v2.ink80,
    letterSpacing: '0.05em',
    margin: 0,
    lineHeight: 1.5,
  },

  // ── Ramp
  rampWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  rampBlock: {
    background: `${v2.ink}88`,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    padding: 24,
  },
  rampLabel: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink80,
    margin: '0 0 16px',
  },
  rampRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: 8,
  },
  rampStop: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rampSwatch: {
    height: 64,
    borderRadius: 8,
    border: `1px solid ${v2.ink40}`,
    marginBottom: 8,
  },
  rampName: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    fontSize: 13,
    color: v2.bone,
    margin: '0 0 2px',
  },
  rampHex: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: v2.ink80,
    margin: '0 0 2px',
  },
  rampRole: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: '0.05em',
    color: v2.ink60,
    margin: 0,
  },

  // ── Trader
  traderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  traderCard: {
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    padding: 28,
  },
  traderLabel: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink80,
    margin: '0 0 12px',
  },
  traderHex: {
    fontFamily: FONT_DISPLAY,
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    margin: '0 0 12px',
  },
  traderNote: {
    fontSize: 13,
    color: v2.ink80,
    lineHeight: 1.5,
    margin: 0,
  },

  // ── Rules
  rules: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  rule: {
    display: 'flex',
    gap: 16,
    padding: 16,
    background: `${v2.ink}88`,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.55,
    color: v2.ink80,
  },
  ruleHash: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: v2.pulse,
    fontWeight: 600,
    letterSpacing: '0.1em',
    flexShrink: 0,
    paddingTop: 1,
  },

  // ── Map table
  mapTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    background: `${v2.ink}88`,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  mapTh: {
    padding: '14px 16px',
    textAlign: 'left' as const,
    fontFamily: FONT_MONO,
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink80,
    borderBottom: `1px solid ${v2.ink40}`,
    background: v2.inkDeep,
  },
  mapTd: {
    padding: '12px 16px',
    fontSize: 13,
    color: v2.bone,
    borderBottom: `1px solid ${v2.ink40}`,
  },
  inlineWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  inlineSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    flexShrink: 0,
  },
  inlineHex: {
    fontFamily: FONT_MONO,
    fontSize: 12,
  },
  dashCell: {
    fontFamily: FONT_MONO,
    fontSize: 14,
    color: v2.ink60,
  },

  // ── Demos
  demoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  demoFrame: {
    background: v2.inkDeep,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 16,
    padding: 24,
  },
  demoFrameLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink60,
    margin: '0 0 16px',
  },
  demoPanel: {
    background: v2.ink,
    border: `1px solid ${v2.ink40}`,
    borderRadius: 12,
    padding: 20,
  },
  demoEyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: v2.ink60,
    margin: '0 0 6px',
  },
  demoTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: v2.ink80,
    margin: '0 0 8px',
  },
  demoBig: {
    fontFamily: FONT_MONO,
    fontSize: 32,
    fontWeight: 600,
    color: v2.good,
    margin: '0 0 12px',
    textShadow: `0 0 12px ${v2.good}55`,
  },
  demoBar: {
    height: 6,
    background: v2.ink20,
    borderRadius: 999,
    overflow: 'hidden' as const,
  },
  demoBarFill: {
    height: '100%',
    background: v2.good,
    borderRadius: 999,
  },
  demoStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  demoBtn: {
    background: `linear-gradient(180deg, ${v2.pulse}, ${v2.pulse700})`,
    color: v2.bone,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    fontSize: 14,
    border: `1px solid ${v2.pulse700}`,
    borderRadius: 10,
    padding: '12px 20px',
    cursor: 'pointer',
    boxShadow: `0 4px 16px ${v2.pulse}33`,
  },
  demoBadges: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  demoBadge: {
    background: v2.inkDeep,
    color: v2.ink80,
    fontFamily: FONT_MONO,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    padding: '5px 10px',
    borderRadius: 999,
    border: `1px solid ${v2.ink40}`,
    fontWeight: 500,
  },
  demoBadgeLive: {
    background: `${v2.good}1F`,
    color: v2.good,
    border: `1px solid ${v2.good}66`,
  },
  demoBadgeDanger: {
    background: `${v2.pulse}1F`,
    color: v2.pulse,
    border: `1px solid ${v2.pulse}66`,
  },
  demoCaption: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: v2.ink60,
    lineHeight: 1.6,
    margin: 0,
  },
  demoTrade: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  demoTradeLong: {
    background: v2.goodDeep,
    border: `1px solid ${v2.good}55`,
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  demoTradeShort: {
    background: v2.badDeep,
    border: `1px solid ${v2.bad}55`,
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  demoTradeMeta: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: v2.ink80,
  },
  demoTradePnl: {
    fontFamily: FONT_MONO,
    fontWeight: 600,
    fontSize: 13,
    color: v2.good,
  },

  // ── Footer
  footer: {
    maxWidth: 1200,
    margin: '0 auto',
    paddingTop: 32,
    borderTop: `1px solid ${v2.ink40}`,
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: v2.ink60,
    textAlign: 'center' as const,
  },
  footerSep: { color: v2.pulse, margin: '0 12px' },
} as const
