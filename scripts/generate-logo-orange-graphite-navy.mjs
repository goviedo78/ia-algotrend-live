import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'public/logo-orange-graphite-navy')
const source = await fs.readFile(path.join(root, 'public/logo-gon-mark.svg'), 'utf8')
const mark = source
  .match(/<g transform="translate\(21\.5 20\) scale\(1\.175\)">[\s\S]*<\/g>\s*<\/svg>/)?.[0]
  ?.replace(/\s*<\/svg>\s*$/, '')

if (!mark) {
  throw new Error('Could not extract the GON mark from public/logo-gon-mark.svg')
}

const c = {
  navy: '#1C1F34',
  navyDeep: '#121525',
  orange: '#EC5E27',
  graphite: '#403D39',
  graphiteDeep: '#282622',
  cream: '#F2DFC3',
  creamMuted: '#D9C8AA',
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
    file: '01-navy-cream-orange.svg',
    name: 'Navy / Cream / Orange',
    note: 'La correcta',
    desc: 'Navy oscuro como base, Cream para lectura y Orange como capa exterior con presencia.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Navy Cream Orange',
      desc: 'Cream GON mark on dark navy with orange outer layer.',
      body: `  <rect width="1000" height="1000" fill="${c.navy}"/>
  <circle cx="500" cy="500" r="500" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="432" fill="${c.navy}"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '02-navy-orange-core.svg',
    name: 'Navy / Orange Core',
    note: 'Mas deportiva',
    desc: 'El logo Orange sobre Navy. Directa, fuerte y usable como icono de producto.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Navy Orange Core',
      desc: 'Orange GON mark on dark navy.',
      body: `  <rect width="1000" height="1000" fill="${c.navy}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.graphite}" stroke-width="10"/>
  ${logo(c.orange)}`,
    }),
  },
  {
    file: '03-graphite-navy-orange.svg',
    name: 'Graphite / Navy / Orange',
    note: 'Industrial premium',
    desc: 'Graphite de fondo, Navy como disco interior y Orange en borde. Menos digital, mas material.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Graphite Navy Orange',
      desc: 'Cream GON mark on navy disk with graphite field and orange ring.',
      body: `  <rect width="1000" height="1000" fill="${c.graphite}"/>
  <circle cx="500" cy="500" r="490" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="448" fill="${c.navy}"/>
  <circle cx="500" cy="500" r="420" fill="none" stroke="${c.graphite}" stroke-width="3" opacity="0.75"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '04-orange-navy-mark.svg',
    name: 'Orange / Navy Mark',
    note: 'Launch limpio',
    desc: 'Orange como campo total y Navy como marca. Mucho impacto sin el azul electrico anterior.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Orange Navy Mark',
      desc: 'Navy GON mark on orange field.',
      body: `  <rect width="1000" height="1000" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.graphite}" stroke-width="12"/>
  ${logo(c.navy)}`,
    }),
  },
  {
    file: '05-navy-graphite-split.svg',
    name: 'Navy / Graphite Split',
    note: 'Sistema oscuro',
    desc: 'Navy arriba, Graphite abajo y Orange como linea de tension. Bueno para motion o fondos.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Navy Graphite Split',
      desc: 'Split navy and graphite field with cream mark and orange separator.',
      body: `  <rect width="1000" height="500" fill="${c.navy}"/>
  <rect y="500" width="1000" height="500" fill="${c.graphite}"/>
  <rect y="492" width="1000" height="16" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="486" fill="none" stroke="${c.cream}" stroke-width="7"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '06-navy-lowkey.svg',
    name: 'Navy Lowkey',
    note: 'Mas elegante',
    desc: 'Casi monocromo: Navy profundo, logo Cream y Orange reducido a un detalle fino.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Navy Lowkey',
      desc: 'Cream GON mark on deep navy with a subtle orange detail.',
      defs: `    <radialGradient id="field" cx="42%" cy="24%" r="72%">
      <stop offset="0" stop-color="${c.navy}"/>
      <stop offset="1" stop-color="${c.navyDeep}"/>
    </radialGradient>`,
      body: `  <rect width="1000" height="1000" fill="url(#field)"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.orange}" stroke-width="6"/>
  <circle cx="500" cy="500" r="460" fill="none" stroke="${c.creamMuted}" stroke-width="2" opacity="0.32"/>
      ${logo(c.cream)}`,
    }),
  },
  {
    file: '07-orange-cream-navy-ring.svg',
    name: 'Orange / Cream / Navy Ring',
    note: 'Tu idea',
    desc: 'Interior naranja, cuerpo pastel claro y aro exterior navy completo. Mas badge, mas contundente.',
    svg: svg({
      title: 'GON Navy Orange Graphite - Orange Cream Navy Ring',
      desc: 'Orange inner field, cream surrounding mark area and full navy outer ring.',
      body: `  <rect width="1000" height="1000" fill="${c.graphiteDeep}"/>
  <circle cx="500" cy="500" r="500" fill="${c.navy}"/>
  <circle cx="500" cy="500" r="430" fill="${c.cream}"/>
  <circle cx="500" cy="500" r="342" fill="${c.orange}"/>
  ${logo(c.cream)}
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.navy}" stroke-width="24"/>`,
    }),
  },
]

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: ${c.navyDeep};
  color: ${c.cream};
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 44px 24px 64px;
}
main { width: min(1180px, 100%); margin: 0 auto; }
.tag {
  background: ${c.orange};
  color: ${c.navy};
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  margin-bottom: 18px;
  padding: 5px 9px;
  text-transform: uppercase;
}
h1 { font-size: clamp(42px, 7vw, 86px); letter-spacing: -.065em; line-height: .92; max-width: 10ch; }
.lede { color: #B9BBC9; font-size: 17px; line-height: 1.55; margin: 18px 0 30px; max-width: 74ch; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.chip {
  border: 1px solid rgba(242, 223, 195, .18);
  border-radius: 999px;
  display: inline-flex;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  padding: 7px 10px;
}
.dot { border-radius: 999px; height: 12px; width: 12px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.card { background: #24283D; border: 1px solid rgba(242, 223, 195, .15); }
.preview { aspect-ratio: 1; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
.meta { border-top: 1px solid rgba(242, 223, 195, .14); padding: 16px; }
.note { color: ${c.orange}; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
h2 { font-size: 19px; letter-spacing: -.03em; margin: 7px 0; }
p { color: #C4B7A8; font-size: 13px; line-height: 1.48; min-height: 58px; }
a {
  border-top: 1px solid rgba(242, 223, 195, .14);
  color: ${c.cream};
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: .1em;
  padding: 11px 16px;
  text-decoration: none;
  text-transform: uppercase;
}
a:hover { background: ${c.orange}; color: ${c.navy}; }
@media (max-width: 980px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { body { padding: 28px 14px 44px; } .grid { grid-template-columns: 1fr; } }
`

const index = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GON - Orange Graphite Navy</title>
<style>${css}</style>
</head>
<body>
<main>
  <span class="tag">GON - Orange Graphite Navy</span>
  <h1>Azul tinta, no electrico</h1>
  <p class="lede">Nueva tanda usando el azul real de tu captura: Navy #1C1F34. Es un azul oscuro, casi tinta, pensado para combinar con Orange #EC5E27 y Graphite #403D39 sin volverse chillón.</p>
  <div class="chips">
    <span class="chip"><span class="dot" style="background:${c.navy}"></span>Navy #1C1F34</span>
    <span class="chip"><span class="dot" style="background:${c.orange}"></span>Orange #EC5E27</span>
    <span class="chip"><span class="dot" style="background:${c.graphite}"></span>Graphite #403D39</span>
    <span class="chip"><span class="dot" style="background:${c.cream}"></span>Cream #F2DFC3</span>
  </div>
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

console.log(`Generated ${variants.length} Orange/Graphite/Navy logo variants in ${path.relative(root, outDir)}`)
