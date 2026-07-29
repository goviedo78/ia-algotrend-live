import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function exists(path) {
  try {
    await access(new URL(path, root))
    return true
  } catch {
    return false
  }
}

test('public launch has no legacy gate or bypass behavior', async () => {
  const proxy = await source('src/proxy.ts')
  const manifest = await source('public/manifest.json')
  const serviceWorker = await source('public/sw.js')

  assert.doesNotMatch(proxy, /BYPASS_TOKEN|BYPASS_COOKIE|__gonovi_dev|searchParams\.get\(['"]dev['"]\)/)
  assert.doesNotMatch(manifest, /dev=materia/)
  assert.doesNotMatch(serviceWorker, /dev=materia/)
})

test('all public official routes are independent of the retired launch flag', async () => {
  const pages = await Promise.all([
    'src/app/auth/page.tsx',
    'src/app/official/page.tsx',
    'src/app/official/apps/page.tsx',
    'src/app/official/mercados/page.tsx',
    'src/app/official/soporte/page.tsx',
    'src/app/official/estrategias/page.tsx',
    'src/app/official/montecarlo/page.tsx',
  ].map(source))

  for (const page of pages) {
    assert.doesNotMatch(page, /OFFICIAL_ENABLED|BYPASS_TOKEN|__gonovi_dev/)
  }
})

test('production deploy verifies the complete public home', async () => {
  const script = await source('scripts/deploy-prod.sh')

  assert.match(script, /Canales y recursos/)
  assert.doesNotMatch(script, /Próximamente|Proximamente/)
})

test('retired launch-screen components are removed', async () => {
  assert.equal(await exists('src/components/official/ComingSoonPage.tsx'), false)
  assert.equal(await exists('src/components/official/coming-soon.module.css'), false)
})
