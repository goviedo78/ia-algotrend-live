import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'public/logo-palette-v2')
const sourcePath = path.join(root, 'public/logo-gon-mark.svg')

const palette = {
  inkDeep: '#11162A',
  ink: '#1C223A',
  ink20: '#2A3148',
  ink40: '#4F5570',
  ink80: '#A8AABA',
  bone80: '#B8AB8E',
  bone90: '#D8C8A6',
  bone: '#E5D4B6',
  bronze: '#C9A87A',
  pulse800: '#A82F08',
  pulse700: '#D43D10',
  pulse: '#F44E1C',
  steel: '#3A3F4D',
  good: '#4FBC72',
}

const source = await fs.readFile(sourcePath, 'utf8')
const markMatch = source.match(/<g transform="translate\(21\.5 20\) scale\(1\.175\)">[\s\S]*<\/g>\s*<\/svg>/)

if (!markMatch) {
  throw new Error(`Could not extract mark from ${sourcePath}`)
}

const mark = markMatch[0].replace(/\s*<\/svg>\s*$/, '')

function svgTemplate({ title, desc, defs = '', background, layers }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${desc}</desc>
  <defs>
${defs}
  </defs>
${background}
${layers}
</svg>
`
}

function markLayer({ fill, filter = '', opacity = 1, transform = '' }) {
  const attrs = [
    fill ? `style="--logo-fg: ${fill}"` : '',
    filter ? `filter="${filter}"` : '',
    opacity !== 1 ? `opacity="${opacity}"` : '',
    transform ? `transform="${transform}"` : '',
  ].filter(Boolean).join(' ')

  return `<g ${attrs}>
    ${mark}
  </g>`
}

const variants = [
  {
    file: '01-ink-bone.svg',
    name: 'Ink / Bone',
    use: 'Principal sobre oscuro',
    desc: 'La version mas estable: Ink como campo y Bone como marca.',
    svg: svgTemplate({
      title: 'GON logo alternative - Ink Bone',
      desc: 'GON mark in Bone on Ink background.',
      background: `  <rect width="1000" height="1000" fill="${palette.ink}"/>`,
      layers: `  <circle cx="500" cy="500" r="468" fill="none" stroke="${palette.ink40}" stroke-width="3"/>
  ${markLayer({ fill: palette.bone })}`,
    }),
  },
  {
    file: '02-bone-ink.svg',
    name: 'Bone / Ink',
    use: 'Principal sobre claro',
    desc: 'La inversa limpia para fondos claros y piezas editoriales.',
    svg: svgTemplate({
      title: 'GON logo alternative - Bone Ink',
      desc: 'GON mark in Ink on Bone background.',
      background: `  <rect width="1000" height="1000" fill="${palette.bone}"/>`,
      layers: `  <circle cx="500" cy="500" r="488" fill="${palette.bone90}"/>
  <circle cx="500" cy="500" r="468" fill="none" stroke="${palette.bronze}" stroke-width="4" opacity="0.7"/>
  ${markLayer({ fill: palette.ink })}`,
    }),
  },
  {
    file: '03-bronze-premium.svg',
    name: 'Bronze Premium',
    use: 'Acento premium',
    desc: 'Bronze como superficie unica, con marca Ink para mantener contraste.',
    svg: svgTemplate({
      title: 'GON logo alternative - Bronze Premium',
      desc: 'GON mark in Ink on Bronze background.',
      defs: `    <radialGradient id="bronzeField" cx="35%" cy="25%" r="78%">
      <stop offset="0" stop-color="${palette.bone90}"/>
      <stop offset="0.42" stop-color="${palette.bronze}"/>
      <stop offset="1" stop-color="${palette.bone80}"/>
    </radialGradient>`,
      background: '  <rect width="1000" height="1000" fill="url(#bronzeField)"/>',
      layers: `  <circle cx="500" cy="500" r="488" fill="none" stroke="${palette.ink}" stroke-width="10" opacity="0.9"/>
  ${markLayer({ fill: palette.ink })}`,
    }),
  },
  {
    file: '04-steel-panel.svg',
    name: 'Steel Panel',
    use: 'UI / surfaces neutras',
    desc: 'Steel como panel intermedio, Bone para lectura y un filo Pulse minimo.',
    svg: svgTemplate({
      title: 'GON logo alternative - Steel Panel',
      desc: 'GON mark in Bone on Steel background with Pulse detail.',
      defs: `    <linearGradient id="steelField" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.steel}"/>
      <stop offset="1" stop-color="${palette.ink20}"/>
    </linearGradient>`,
      background: '  <rect width="1000" height="1000" fill="url(#steelField)"/>',
      layers: `  <circle cx="500" cy="500" r="486" fill="${palette.ink}" opacity="0.18"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${palette.pulse}" stroke-width="8"/>
  ${markLayer({ fill: palette.bone })}`,
    }),
  },
  {
    file: '05-pulse-signal.svg',
    name: 'Pulse Signal',
    use: 'CTA / alerta / launch',
    desc: 'Pulse en primer plano con glow controlado; no para uso permanente.',
    svg: svgTemplate({
      title: 'GON logo alternative - Pulse Signal',
      desc: 'GON mark in Pulse on deep Ink background with glow.',
      defs: `    <filter id="pulseGlow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="18" in="SourceAlpha" result="blur"/>
      <feFlood flood-color="${palette.pulse}" flood-opacity="0.72"/>
      <feComposite in2="blur" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`,
      background: `  <rect width="1000" height="1000" fill="${palette.inkDeep}"/>`,
      layers: `  <circle cx="500" cy="500" r="492" fill="none" stroke="${palette.pulse800}" stroke-width="16" opacity="0.8"/>
  ${markLayer({ fill: palette.pulse, filter: 'url(#pulseGlow)' })}`,
    }),
  },
  {
    file: '06-ink-bronze.svg',
    name: 'Ink / Bronze',
    use: 'Premium oscuro',
    desc: 'Bronze queda como spice sobre Ink; elegante y menos obvio que Pulse.',
    svg: svgTemplate({
      title: 'GON logo alternative - Ink Bronze',
      desc: 'GON mark in Bronze on Ink background.',
      defs: `    <radialGradient id="nightField" cx="50%" cy="30%" r="70%">
      <stop offset="0" stop-color="${palette.ink20}"/>
      <stop offset="1" stop-color="${palette.inkDeep}"/>
    </radialGradient>`,
      background: '  <rect width="1000" height="1000" fill="url(#nightField)"/>',
      layers: `  <circle cx="500" cy="500" r="488" fill="none" stroke="${palette.steel}" stroke-width="5"/>
  ${markLayer({ fill: palette.bronze })}`,
    }),
  },
  {
    file: '07-editorial-cream.svg',
    name: 'Editorial Cream',
    use: 'Poster / print / sello',
    desc: 'Tratamiento retro editorial: Bone, Ink y Bronze con borde fuerte.',
    svg: svgTemplate({
      title: 'GON logo alternative - Editorial Cream',
      desc: 'GON mark in Ink on cream circular badge with Bronze outer field.',
      background: `  <rect width="1000" height="1000" fill="${palette.bronze}"/>`,
      layers: `  <circle cx="500" cy="500" r="500" fill="${palette.bronze}"/>
  <circle cx="500" cy="500" r="430" fill="${palette.bone}"/>
  <circle cx="500" cy="500" r="490" fill="none" stroke="${palette.ink}" stroke-width="20"/>
  ${markLayer({ fill: palette.ink, transform: 'translate(35 35) scale(0.93)' })}`,
    }),
  },
  {
    file: '08-live-state.svg',
    name: 'Live State',
    use: 'Trading / estado activo',
    desc: 'Version de producto: marca Bone, estado live en verde semantico.',
    svg: svgTemplate({
      title: 'GON logo alternative - Live State',
      desc: 'GON mark in Bone on Ink background with semantic green live indicator.',
      defs: `    <filter id="liveGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feFlood flood-color="${palette.good}" flood-opacity="0.72"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`,
      background: `  <rect width="1000" height="1000" fill="${palette.ink}"/>`,
      layers: `  <circle cx="500" cy="500" r="488" fill="none" stroke="${palette.ink40}" stroke-width="5"/>
  ${markLayer({ fill: palette.bone })}
  <circle cx="768" cy="220" r="58" fill="${palette.good}" filter="url(#liveGlow)"/>
  <circle cx="768" cy="220" r="26" fill="${palette.ink}"/>`,
    }),
  },
]

const css = `
  :root {
    --ink-deep: ${palette.inkDeep};
    --ink: ${palette.ink};
    --ink-20: ${palette.ink20};
    --ink-40: ${palette.ink40};
    --ink-80: ${palette.ink80};
    --bone: ${palette.bone};
    --bronze: ${palette.bronze};
    --pulse: ${palette.pulse};
    --steel: ${palette.steel};
    --good: ${palette.good};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--pulse) 22%, transparent), transparent 26rem),
      linear-gradient(135deg, var(--ink-deep), var(--ink));
    color: var(--bone);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 44px 24px 64px;
  }
  header,
  main,
  footer { width: min(1280px, 100%); margin-inline: auto; }
  header { display: grid; gap: 18px; margin-bottom: 34px; }
  .badge {
    width: fit-content;
    background: var(--bone);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    padding: 4px 9px;
    text-transform: uppercase;
  }
  h1 {
    font-size: clamp(40px, 7vw, 92px);
    letter-spacing: -0.065em;
    line-height: 0.92;
    max-width: 11ch;
  }
  .lede {
    color: var(--ink-80);
    font-size: 17px;
    line-height: 1.55;
    max-width: 74ch;
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 34px;
  }
  .chip {
    border: 1px solid color-mix(in srgb, var(--bone) 18%, transparent);
    border-radius: 999px;
    color: var(--bone);
    display: inline-flex;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    gap: 8px;
    letter-spacing: 0.03em;
    padding: 7px 10px;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .card {
    background: color-mix(in srgb, var(--ink-20) 70%, transparent);
    border: 1px solid color-mix(in srgb, var(--bone) 16%, transparent);
    overflow: hidden;
  }
  .preview { aspect-ratio: 1; background: var(--ink-deep); }
  .preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .meta { border-top: 1px solid color-mix(in srgb, var(--bone) 14%, transparent); padding: 16px; }
  .num {
    color: var(--pulse);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h2 { font-size: 19px; letter-spacing: -0.025em; margin: 7px 0 5px; }
  .use {
    color: var(--bronze);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .desc { color: var(--ink-80); font-size: 13px; line-height: 1.45; min-height: 56px; }
  a {
    border-top: 1px solid color-mix(in srgb, var(--bone) 14%, transparent);
    color: var(--bone);
    display: block;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    padding: 11px 16px;
    text-decoration: none;
    text-transform: uppercase;
  }
  a:hover { background: var(--pulse); color: var(--bone); }
  footer {
    color: var(--ink-80);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    margin-top: 32px;
    text-transform: uppercase;
  }
  @media (max-width: 980px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) {
    body { padding: 28px 14px 44px; }
    .grid { grid-template-columns: 1fr; }
  }
`

const chips = [
  ['Ink', palette.ink],
  ['Bone', palette.bone],
  ['Bronze', palette.bronze],
  ['Pulse', palette.pulse],
  ['Steel', palette.steel],
  ['Good', palette.good],
]

const index = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GON - Alternativas paleta v2</title>
<style>${css}</style>
</head>
<body>
  <header>
    <span class="badge">GON - Palette v2</span>
    <h1>Alternativas de color</h1>
    <p class="lede">Misma geometria del logo GON, explorada con la paleta Navy + Cream + Vivid + Steel. Pulse queda reservado para versiones de senal/accion; Bronze se usa como acento premium y Steel como superficie neutral.</p>
  </header>
  <main>
    <div class="palette">
      ${chips.map(([label, color]) => `<span class="chip"><span class="dot" style="background:${color}"></span>${label} ${color}</span>`).join('\n      ')}
    </div>
    <section class="grid">
      ${variants.map((variant, index) => `<article class="card">
        <div class="preview"><img src="${variant.file}" alt="${variant.name}" /></div>
        <div class="meta">
          <div class="num">${String(index + 1).padStart(2, '0')}</div>
          <h2>${variant.name}</h2>
          <div class="use">${variant.use}</div>
          <p class="desc">${variant.desc}</p>
        </div>
        <a href="${variant.file}">Abrir SVG</a>
      </article>`).join('\n      ')}
    </section>
  </main>
  <footer>Generado desde public/logo-gon-mark.svg - paleta https://algotrend.vercel.app/brand/palette</footer>
</body>
</html>
`

await fs.rm(outDir, { recursive: true, force: true })
await fs.mkdir(outDir, { recursive: true })
await Promise.all(variants.map((variant) => fs.writeFile(path.join(outDir, variant.file), variant.svg)))
await fs.writeFile(path.join(outDir, 'index.html'), index)

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await page.goto(`file://${path.join(outDir, 'index.html')}`, { waitUntil: 'networkidle0' })
await page.screenshot({
  path: path.join(outDir, 'contact-sheet.png'),
  fullPage: true,
})
await browser.close()

console.log(`Generated ${variants.length} SVG variants in ${path.relative(root, outDir)}`)
