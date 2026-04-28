/**
 * render-presets.mjs
 *
 * Captura un PNG por cada preset de MateriaLogo abriendo /brand/materia?preset=X
 * en headless Chrome. Requiere que el server esté corriendo (local o Vercel).
 *
 * Uso:
 *   node scripts/render-presets.mjs                     # contra Vercel default
 *   BASE_URL=http://localhost:3000 node scripts/...     # contra local dev server
 *   SIZE=1600 node scripts/...                          # tamaño custom (default 2048)
 */

import puppeteer from 'puppeteer'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESETS = ['brasa', 'plata', 'cobre', 'obsidiana', 'magma', 'hielo']
const BASE_URL = process.env.BASE_URL || 'https://fusion-engine-live.vercel.app'
const SIZE = parseInt(process.env.SIZE || '2048', 10)
const ENTRY_WAIT = 3500   // ms para que termine la entrada de cámara
const FRAME_WAIT = 600    // ms extra para que el shader compile y la materia esté en reposo
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '..', 'public', 'logo-alternatives')

console.log(`→ Base URL: ${BASE_URL}`)
console.log(`→ Output:   ${OUT_DIR}`)
console.log(`→ Size:     ${SIZE}×${SIZE}`)
console.log(`→ Presets:  ${PRESETS.join(', ')}`)

await mkdir(OUT_DIR, { recursive: true })

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--use-gl=angle',
    '--enable-webgl',
    '--disable-features=VizDisplayCompositor',
  ],
})

try {
  for (const preset of PRESETS) {
    const page = await browser.newPage()
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

    const url = `${BASE_URL}/brand/materia?preset=${preset}&render=1`
    console.log(`\n[${preset}] navigating → ${url}`)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })

    // Esperar a que el canvas exista
    await page.waitForSelector('canvas', { timeout: 30_000 })

    // Esperar entry + frame extra
    await new Promise((r) => setTimeout(r, ENTRY_WAIT + FRAME_WAIT))

    // page.screenshot captura desde el compositor → funciona aunque WebGL
    // tenga preserveDrawingBuffer=false (que es el default en R3F).
    const outFile = resolve(OUT_DIR, `3d-${preset}.png`)
    await page.screenshot({ path: outFile, type: 'png', omitBackground: false })
    const fs = await import('node:fs/promises')
    const stat = await fs.stat(outFile)
    console.log(`[${preset}] saved → ${outFile} (${(stat.size / 1024).toFixed(0)}KB)`)

    await page.close()
  }
} finally {
  await browser.close()
}

console.log('\n✓ Done.')
