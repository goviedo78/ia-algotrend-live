import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

const root = process.cwd()
const outDir = path.join(root, 'public/youtube')
const bannerHtml = path.join(outDir, 'banner-gon-pinescript.html')
const bannerPng = path.join(outDir, 'banner-gon-pinescript.png')
const bannerPreview = path.join(outDir, 'banner-gon-pinescript-safe-preview.png')

await fs.mkdir(outDir, { recursive: true })

const pineCode = [
  '//@version=6',
  'indicator("GON Fusion Engine", overlay=true, max_labels_count=500)',
  'fast = ta.ema(close, 21)',
  'slow = ta.ema(close, 55)',
  'trend = fast > slow ? 1 : -1',
  'atr = ta.atr(14)',
  'signalLong = ta.crossover(fast, slow) and close > fast',
  'signalShort = ta.crossunder(fast, slow) and close < fast',
  'risk = strategy.equity * 0.01',
  'plot(fast, "EMA 21", color=color.orange)',
  'plot(slow, "EMA 55", color=color.navy)',
  'alertcondition(signalLong, "LONG", "Momentum confirmado")',
  'alertcondition(signalShort, "SHORT", "Riesgo detectado")',
]

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GON YouTube Banner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #1C1F34;
    --navy-deep: #121525;
    --cream: #F2DFC3;
    --cream-soft: #D9C8AA;
    --orange: #EC5E27;
    --graphite: #403D39;
    --graphite-deep: #282622;
    --display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  * { box-sizing: border-box; }
  html,
  body {
    width: 2560px;
    height: 1440px;
    margin: 0;
    overflow: hidden;
    background: var(--navy-deep);
  }

  .banner {
    position: relative;
    width: 2560px;
    height: 1440px;
    overflow: hidden;
    color: var(--cream);
    background:
      radial-gradient(circle at 78% 42%, rgba(236, 94, 39, 0.24), transparent 520px),
      radial-gradient(circle at 23% 78%, rgba(242, 223, 195, 0.12), transparent 460px),
      linear-gradient(135deg, #111525 0%, var(--navy) 48%, #171A2E 100%);
    font-family: var(--display);
  }

  .noise {
    position: absolute;
    inset: 0;
    opacity: 0.13;
    background-image:
      linear-gradient(rgba(242, 223, 195, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(242, 223, 195, 0.07) 1px, transparent 1px);
    background-size: 80px 80px;
    mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
  }

  .code {
    position: absolute;
    top: 90px;
    left: 90px;
    width: 920px;
    height: 1160px;
    padding: 54px 58px;
    border: 1px solid rgba(242, 223, 195, 0.11);
    background: rgba(18, 21, 37, 0.55);
    color: rgba(242, 223, 195, 0.2);
    font: 500 31px/1.72 var(--mono);
    letter-spacing: -0.02em;
    transform: rotate(-3deg);
    filter: blur(0.2px);
  }

  .code .line { white-space: nowrap; }
  .code .orange { color: rgba(236, 94, 39, 0.4); }
  .code .cream { color: rgba(242, 223, 195, 0.32); }
  .code::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(18, 21, 37, 0.2), rgba(18, 21, 37, 0.82));
  }

  .safe {
    position: absolute;
    left: 507px;
    top: 508px;
    width: 1546px;
    height: 423px;
  }

  .title-card {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr 330px;
    align-items: center;
    gap: 54px;
    padding: 0 8px;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
    color: var(--cream-soft);
    font: 700 28px/1 var(--mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--orange);
    box-shadow: 0 0 0 8px rgba(236, 94, 39, 0.16);
  }

  h1 {
    margin: 0;
    font: 700 108px/0.9 var(--display);
    letter-spacing: -0.07em;
    text-transform: uppercase;
  }

  h1 .orange { color: var(--orange); }

  .motto {
    max-width: 1040px;
    margin-top: 24px;
    color: var(--cream);
    font: 700 30px/1.25 var(--display);
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  .motto span {
    color: var(--cream-soft);
    font-weight: 500;
  }

  .logo-wrap {
    position: relative;
    width: 318px;
    height: 318px;
    border-radius: 50%;
    background: var(--orange);
    box-shadow:
      0 0 0 18px rgba(236, 94, 39, 0.15),
      0 28px 80px rgba(0, 0, 0, 0.28);
  }

  .logo-wrap img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .right-marks {
    position: absolute;
    right: 82px;
    top: 134px;
    color: var(--orange);
    font: 700 620px/0.7 var(--display);
    letter-spacing: -0.2em;
    opacity: 0.92;
  }

  .ticker {
    position: absolute;
    right: 90px;
    bottom: 100px;
    display: flex;
    gap: 18px;
    color: rgba(242, 223, 195, 0.76);
    font: 700 25px/1 var(--mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pill {
    padding: 14px 18px;
    border: 1px solid rgba(242, 223, 195, 0.16);
    background: rgba(64, 61, 57, 0.44);
  }

  .pill strong { color: var(--orange); }

  .corner-card {
    position: absolute;
    right: 94px;
    top: 92px;
    width: 380px;
    height: 160px;
    border-radius: 52px;
    border: 1px solid rgba(242, 223, 195, 0.12);
    background: rgba(242, 223, 195, 0.08);
  }

  .corner-card::before {
    content: "01";
    position: absolute;
    right: 34px;
    bottom: 18px;
    color: var(--orange);
    font: 700 92px/1 var(--display);
    letter-spacing: -0.07em;
  }

  .corner-card::after {
    content: "PINE TOOLS";
    position: absolute;
    left: 34px;
    top: 34px;
    color: var(--cream);
    font: 700 24px/1.05 var(--mono);
    letter-spacing: 0.06em;
  }

  .safe-guides {
    display: none;
    position: absolute;
    left: 507px;
    top: 508px;
    width: 1546px;
    height: 423px;
    border: 4px dashed rgba(242, 223, 195, 0.35);
    pointer-events: none;
  }

  body.preview .safe-guides { display: block; }
</style>
</head>
<body>
<main class="banner">
  <div class="noise"></div>
  <section class="code" aria-hidden="true">
    ${pineCode.map((line, index) => {
      const cls = index % 4 === 0 ? 'orange' : index % 3 === 0 ? 'cream' : ''
      return `<div class="line ${cls}">${line}</div>`
    }).join('\n    ')}
  </section>
  <div class="right-marks" aria-hidden="true">”</div>
  <div class="corner-card" aria-hidden="true"></div>
  <section class="safe">
    <div class="title-card">
      <div>
        <div class="badge-row"><span class="dot"></span>Pine Script · Finanzas · Indicadores</div>
        <h1>GON <span class="orange">Trading</span><br/>Tools</h1>
        <p class="motto">Acumulamos herramientas y conocimiento <span>para hacer de nuestra vida un mejor camino</span></p>
      </div>
      <div class="logo-wrap">
        <img src="../logo-orange-graphite-navy/01-navy-cream-orange-transparent-medium-border.png" alt="GON logo">
      </div>
    </div>
  </section>
  <div class="ticker" aria-hidden="true">
    <div class="pill">BTC <strong>+2.4%</strong></div>
    <div class="pill">SPX <strong>RISK ON</strong></div>
    <div class="pill">ALERTS <strong>LIVE</strong></div>
  </div>
  <div class="safe-guides" aria-hidden="true"></div>
</main>
</body>
</html>
`

await fs.writeFile(bannerHtml, html)

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 2560, height: 1440, deviceScaleFactor: 1 })
await page.goto(`file://${bannerHtml}`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: bannerPng, clip: { x: 0, y: 0, width: 2560, height: 1440 } })

await page.evaluate(() => document.body.classList.add('preview'))
await page.screenshot({ path: bannerPreview, clip: { x: 0, y: 0, width: 2560, height: 1440 } })

await browser.close()

console.log(`Generated ${path.relative(root, bannerPng)}`)
console.log(`Generated ${path.relative(root, bannerPreview)}`)
