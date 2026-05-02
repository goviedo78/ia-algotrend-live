import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'public/logo-orange-graphite')
const source = await fs.readFile(path.join(root, 'public/logo-gon-mark.svg'), 'utf8')
const mark = source
  .match(/<g transform="translate\(21\.5 20\) scale\(1\.175\)">[\s\S]*<\/g>\s*<\/svg>/)?.[0]
  ?.replace(/\s*<\/svg>\s*$/, '')

if (!mark) {
  throw new Error('Could not extract the GON mark from public/logo-gon-mark.svg')
}

const c = {
  orange: '#EC5E27',
  graphite: '#403D39',
  graphiteDeep: '#282622',
  graphiteSoft: '#57534C',
  cream: '#F2DFC3',
  white: '#FFF6E8',
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
    file: '01-graphite-orange-core.svg',
    name: 'Graphite / Orange Core',
    note: 'Principal fuerte',
    desc: 'Graphite domina y Orange queda como logo completo. Es la version mas directa y potente.',
    svg: svg({
      title: 'GON Orange Graphite - Graphite Orange Core',
      desc: 'Orange GON mark over Graphite background.',
      body: `  <rect width="1000" height="1000" fill="${c.graphite}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.graphiteSoft}" stroke-width="5"/>
  ${logo(c.orange)}`,
    }),
  },
  {
    file: '02-orange-graphite-core.svg',
    name: 'Orange / Graphite Core',
    note: 'Launch loud',
    desc: 'Campo Orange con logo Graphite. Muy visible, ideal para portada, splash o campana.',
    svg: svg({
      title: 'GON Orange Graphite - Orange Graphite Core',
      desc: 'Graphite GON mark over Orange background.',
      body: `  <rect width="1000" height="1000" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.graphite}" stroke-width="10"/>
  ${logo(c.graphite)}`,
    }),
  },
  {
    file: '03-graphite-orange-ring.svg',
    name: 'Graphite / Orange Ring',
    note: 'Capa exterior',
    desc: 'Aro Orange grueso como capa total, centro Graphite y logo Cream para mas lectura.',
    svg: svg({
      title: 'GON Orange Graphite - Graphite Orange Ring',
      desc: 'Thick Orange outer ring, Graphite center and Cream mark.',
      body: `  <rect width="1000" height="1000" fill="${c.graphite}"/>
  <circle cx="500" cy="500" r="500" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="422" fill="${c.graphite}"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '04-orange-graphite-ring.svg',
    name: 'Orange / Graphite Ring',
    note: 'Inversion agresiva',
    desc: 'Nucleo Orange con borde Graphite grueso. Se siente mas industrial y deportivo.',
    svg: svg({
      title: 'GON Orange Graphite - Orange Graphite Ring',
      desc: 'Thick Graphite outer ring, Orange center and Graphite mark.',
      body: `  <rect width="1000" height="1000" fill="${c.orange}"/>
  <circle cx="500" cy="500" r="500" fill="${c.graphite}"/>
  <circle cx="500" cy="500" r="422" fill="${c.orange}"/>
  ${logo(c.graphite)}`,
    }),
  },
  {
    file: '05-split-signal.svg',
    name: 'Split Signal',
    note: 'Doble lectura',
    desc: 'Mitad Orange, mitad Graphite. Funciona como asset dinamico para trading o live states.',
    svg: svg({
      title: 'GON Orange Graphite - Split Signal',
      desc: 'Split Orange and Graphite field with Cream GON mark.',
      body: `  <rect width="1000" height="500" fill="${c.orange}"/>
  <rect y="500" width="1000" height="500" fill="${c.graphite}"/>
  <circle cx="500" cy="500" r="486" fill="none" stroke="${c.cream}" stroke-width="8"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '06-graphite-cream-orange.svg',
    name: 'Graphite / Cream / Orange',
    note: 'Mas elegante',
    desc: 'Graphite de fondo, logo Cream y Orange solo como detalle. La opcion mas premium.',
    svg: svg({
      title: 'GON Orange Graphite - Graphite Cream Orange',
      desc: 'Cream GON mark on Graphite with subtle Orange accent.',
      body: `  <rect width="1000" height="1000" fill="${c.graphiteDeep}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.orange}" stroke-width="14"/>
  <circle cx="500" cy="500" r="456" fill="none" stroke="${c.cream}" stroke-width="2" opacity="0.32"/>
  ${logo(c.cream)}`,
    }),
  },
  {
    file: '07-orange-shadow.svg',
    name: 'Orange Shadow',
    note: 'Impacto 3D plano',
    desc: 'Logo Cream con sombra Graphite desplazada sobre Orange. Tiene energia poster/sportswear.',
    svg: svg({
      title: 'GON Orange Graphite - Orange Shadow',
      desc: 'Cream GON mark with Graphite offset shadow on Orange background.',
      defs: `    <filter id="softShadow" x="-18%" y="-18%" width="136%" height="136%">
      <feDropShadow dx="28" dy="34" stdDeviation="0" flood-color="${c.graphite}" flood-opacity="1"/>
    </filter>`,
      body: `  <rect width="1000" height="1000" fill="${c.orange}"/>
  ${logo(c.cream, 'filter="url(#softShadow)"')}`,
    }),
  },
  {
    file: '08-graphite-glow.svg',
    name: 'Graphite Glow',
    note: 'Tech nocturno',
    desc: 'Orange con glow sobre Graphite profundo. Bueno para app icon, loader o modo oscuro.',
    svg: svg({
      title: 'GON Orange Graphite - Graphite Glow',
      desc: 'Glowing Orange GON mark on deep Graphite background.',
      defs: `    <filter id="orangeGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" in="SourceAlpha" result="blur"/>
      <feFlood flood-color="${c.orange}" flood-opacity="0.74"/>
      <feComposite in2="blur" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`,
      body: `  <rect width="1000" height="1000" fill="${c.graphiteDeep}"/>
  <circle cx="500" cy="500" r="488" fill="none" stroke="${c.graphiteSoft}" stroke-width="6"/>
  ${logo(c.orange, 'filter="url(#orangeGlow)"')}`,
    }),
  },
]

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: ${c.graphiteDeep};
  color: ${c.cream};
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 44px 24px 64px;
}
main { width: min(1280px, 100%); margin: 0 auto; }
.tag {
  background: ${c.orange};
  color: ${c.graphite};
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  margin-bottom: 18px;
  padding: 5px 9px;
  text-transform: uppercase;
}
h1 { font-size: clamp(42px, 7vw, 88px); letter-spacing: -.065em; line-height: .92; max-width: 10ch; }
.lede { color: #C4B7A8; font-size: 17px; line-height: 1.55; margin: 18px 0 34px; max-width: 72ch; }
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
.card { background: ${c.graphite}; border: 1px solid rgba(242, 223, 195, .15); }
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
a:hover { background: ${c.orange}; color: ${c.graphite}; }
@media (max-width: 980px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { body { padding: 28px 14px 44px; } .grid { grid-template-columns: 1fr; } }
`

const index = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GON - Orange Graphite</title>
<style>${css}</style>
</head>
<body>
<main>
  <span class="tag">GON - Orange Graphite</span>
  <h1>Mas energia, mas contraste</h1>
  <p class="lede">Exploraciones con Orange #EC5E27 y Graphite #403D39. La clave es decidir si Orange domina como energia de lanzamiento o si queda como acento sobre una base Graphite mas premium.</p>
  <div class="chips">
    <span class="chip"><span class="dot" style="background:${c.orange}"></span>Orange #EC5E27</span>
    <span class="chip"><span class="dot" style="background:${c.graphite}"></span>Graphite #403D39</span>
    <span class="chip"><span class="dot" style="background:${c.cream}"></span>Cream apoyo #F2DFC3</span>
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
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
await page.goto(`file://${path.join(outDir, 'index.html')}`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: path.join(outDir, 'contact-sheet.png'), fullPage: true })
await browser.close()

console.log(`Generated ${variants.length} Orange/Graphite logo variants in ${path.relative(root, outDir)}`)
