import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'public/logo-elegant-triads')
const source = await fs.readFile(path.join(root, 'public/logo-gon-mark.svg'), 'utf8')
const mark = source
  .match(/<g transform="translate\(21\.5 20\) scale\(1\.175\)">[\s\S]*<\/g>\s*<\/svg>/)?.[0]
  ?.replace(/\s*<\/svg>\s*$/, '')

if (!mark) {
  throw new Error('Could not extract the GON mark from public/logo-gon-mark.svg')
}

const c = {
  ink: '#1C223A',
  inkDeep: '#11162A',
  inkSoft: '#2A3148',
  bone: '#E5D4B6',
  boneSoft: '#D8C8A6',
  bronze: '#C9A87A',
  pulse: '#F44E1C',
  steel: '#3A3F4D',
}

function logo(fill, extra = '') {
  return `<g style="--logo-fg: ${fill}" ${extra}>
    ${mark}
  </g>`
}

function svg({ title, desc, defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${desc}</desc>
  <defs>
${defs}
  </defs>
${body}
</svg>
`
}

const variants = [
  {
    file: '01-ink-bone-bronze.svg',
    name: 'Ink / Bone / Bronze',
    note: 'La recomendada',
    desc: 'Base Ink, logo Bone y aro Bronze fino. Es la mas elegante y usable como marca principal.',
    svg: svg({
      title: 'GON elegant triad - Ink Bone Bronze',
      desc: 'GON logo with Ink background, Bone mark and Bronze outer ring.',
      body: `  <rect width="1000" height="1000" fill="${c.ink}"/>
  <circle cx="500" cy="500" r="486" fill="none" stroke="${c.bronze}" stroke-width="10"/>
  <circle cx="500" cy="500" r="456" fill="none" stroke="${c.bone}" stroke-width="2" opacity="0.22"/>
  ${logo(c.bone)}`,
    }),
  },
  {
    file: '02-bone-ink-bronze.svg',
    name: 'Bone / Ink / Bronze',
    note: 'Editorial claro',
    desc: 'Fondo Bone, logo Ink y Bronze como anillo. Ideal para web clara, documentos y piezas premium.',
    svg: svg({
      title: 'GON elegant triad - Bone Ink Bronze',
      desc: 'GON logo with Bone background, Ink mark and Bronze ring.',
      body: `  <rect width="1000" height="1000" fill="${c.bone}"/>
  <circle cx="500" cy="500" r="488" fill="${c.boneSoft}"/>
  <circle cx="500" cy="500" r="486" fill="none" stroke="${c.bronze}" stroke-width="12"/>
  ${logo(c.ink)}`,
    }),
  },
  {
    file: '03-bronze-ink-bone.svg',
    name: 'Bronze / Ink / Bone',
    note: 'Sello premium',
    desc: 'Bronze domina, Ink da estructura y Bone ilumina. Buena para badge, portada o asset especial.',
    svg: svg({
      title: 'GON elegant triad - Bronze Ink Bone',
      desc: 'GON logo with Bronze field, Ink mark and Bone ring.',
      defs: `    <radialGradient id="field" cx="38%" cy="24%" r="72%">
      <stop offset="0" stop-color="${c.boneSoft}"/>
      <stop offset="0.46" stop-color="${c.bronze}"/>
      <stop offset="1" stop-color="#9B7D54"/>
    </radialGradient>`,
      body: `  <rect width="1000" height="1000" fill="url(#field)"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.ink}" stroke-width="12"/>
  <circle cx="500" cy="500" r="456" fill="none" stroke="${c.bone}" stroke-width="3" opacity="0.75"/>
  ${logo(c.ink)}`,
    }),
  },
  {
    file: '04-ink-bronze-bone.svg',
    name: 'Ink / Bronze / Bone',
    note: 'Luxury oscuro',
    desc: 'Logo Bronze sobre Ink, con Bone apenas como luz exterior. Mas sobria, menos contrastada.',
    svg: svg({
      title: 'GON elegant triad - Ink Bronze Bone',
      desc: 'GON logo with Ink background, Bronze mark and Bone fine ring.',
      defs: `    <radialGradient id="night" cx="50%" cy="32%" r="68%">
      <stop offset="0" stop-color="${c.inkSoft}"/>
      <stop offset="1" stop-color="${c.inkDeep}"/>
    </radialGradient>`,
      body: `  <rect width="1000" height="1000" fill="url(#night)"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.bone}" stroke-width="4" opacity="0.5"/>
  <circle cx="500" cy="500" r="468" fill="none" stroke="${c.bronze}" stroke-width="5"/>
  ${logo(c.bronze)}`,
    }),
  },
  {
    file: '05-ink-bone-pulse.svg',
    name: 'Ink / Bone / Pulse',
    note: 'Accion controlada',
    desc: 'Misma base elegante, con Pulse como segunda capa exterior completa. Sirve para CTA o lanzamiento.',
    svg: svg({
      title: 'GON elegant triad - Ink Bone Pulse',
      desc: 'GON logo with Ink background, Bone mark and a thick Pulse outer layer.',
      body: `  <rect width="1000" height="1000" fill="${c.ink}"/>
  <circle cx="500" cy="500" r="500" fill="${c.pulse}"/>
  <circle cx="500" cy="500" r="432" fill="${c.ink}"/>
  <circle cx="500" cy="500" r="452" fill="none" stroke="${c.bone}" stroke-width="2" opacity="0.18"/>
  ${logo(c.bone)}`,
    }),
  },
  {
    file: '06-steel-bone-bronze.svg',
    name: 'Steel / Bone / Bronze',
    note: 'UI tecnico',
    desc: 'Steel suaviza el fondo, Bone mantiene lectura y Bronze da sofisticacion sin gritar.',
    svg: svg({
      title: 'GON elegant triad - Steel Bone Bronze',
      desc: 'GON logo with Steel background, Bone mark and Bronze accents.',
      defs: `    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.steel}"/>
      <stop offset="1" stop-color="${c.ink}"/>
    </linearGradient>`,
      body: `  <rect width="1000" height="1000" fill="url(#steel)"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.bronze}" stroke-width="8"/>
  <circle cx="500" cy="500" r="438" fill="none" stroke="${c.bronze}" stroke-width="2" opacity="0.42"/>
  ${logo(c.bone)}`,
    }),
  },
]

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: ${c.inkDeep};
  color: ${c.bone};
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 44px 24px 64px;
}
main { width: min(1180px, 100%); margin: 0 auto; }
.eyebrow {
  background: ${c.bronze};
  color: ${c.ink};
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  margin-bottom: 18px;
  padding: 5px 9px;
  text-transform: uppercase;
}
h1 { font-size: clamp(42px, 7vw, 86px); letter-spacing: -0.06em; line-height: .92; max-width: 10ch; }
.lede { color: #A8AABA; font-size: 17px; line-height: 1.55; margin: 18px 0 34px; max-width: 70ch; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card { background: #242B43; border: 1px solid rgba(229,212,182,.18); }
.preview { aspect-ratio: 1; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
.meta { border-top: 1px solid rgba(229,212,182,.16); padding: 16px; }
.note { color: ${c.bronze}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
h2 { font-size: 20px; letter-spacing: -.03em; margin: 7px 0; }
p { color: #B9BBC9; font-size: 13px; line-height: 1.48; min-height: 58px; }
a {
  border-top: 1px solid rgba(229,212,182,.16);
  color: ${c.bone};
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: .1em;
  padding: 11px 16px;
  text-decoration: none;
  text-transform: uppercase;
}
a:hover { background: ${c.bronze}; color: ${c.ink}; }
@media (max-width: 820px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { body { padding: 28px 14px 44px; } .grid { grid-template-columns: 1fr; } }
`

const index = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GON - combinaciones elegantes</title>
<style>${css}</style>
</head>
<body>
<main>
  <span class="eyebrow">GON - combinaciones elegantes</span>
  <h1>Tres colores, una jerarquia</h1>
  <p class="lede">La clave es que un color domine, otro sostenga la lectura y el tercero aparezca como acento. La primera opcion es la recomendada para uso principal.</p>
  <section class="grid">
    ${variants.map((v) => `<article class="card">
      <div class="preview"><img src="${v.file}" alt="${v.name}" /></div>
      <div class="meta">
        <div class="note">${v.note}</div>
        <h2>${v.name}</h2>
        <p>${v.desc}</p>
      </div>
      <a href="${v.file}">Abrir SVG</a>
    </article>`).join('\n    ')}
  </section>
</main>
</body>
</html>
`

await fs.rm(outDir, { recursive: true, force: true })
await fs.mkdir(outDir, { recursive: true })
await Promise.all(variants.map((v) => fs.writeFile(path.join(outDir, v.file), v.svg)))
await fs.writeFile(path.join(outDir, 'index.html'), index)

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 })
await page.goto(`file://${path.join(outDir, 'index.html')}`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: path.join(outDir, 'contact-sheet.png'), fullPage: true })
await browser.close()

console.log(`Generated ${variants.length} elegant triads in ${path.relative(root, outDir)}`)
