import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('the browser cannot submit candles that mutate live trades', async () => {
  const dashboard = await source('src/components/Dashboard.tsx')

  assert.doesNotMatch(dashboard, /fetch\(['"]\/api\/signal['"]/)
})

test('the legacy signal endpoint is fail-closed', async () => {
  const route = await source('src/app/api/signal/route.ts')

  assert.match(route, /status:\s*410/)
  assert.doesNotMatch(route, /openTrade|closeTrade|updateOpenTradeRisk/)
})

test('the trading cron always fetches uncached candles', async () => {
  const route = await source('src/app/api/cron/check/route.ts')

  assert.match(route, /fetch\(reqUrl,\s*\{\s*cache:\s*['"]no-store['"]\s*\}\)/)
  assert.doesNotMatch(route, /next:\s*\{\s*revalidate:/)
})

test('the candle API does not cache a partially formed market candle', async () => {
  const route = await source('src/app/api/candles/route.ts')

  assert.match(route, /fetch\(reqUrl,\s*\{\s*cache:\s*['"]no-store['"]\s*\}\)/)
  assert.match(route, /['"]Cache-Control['"]:\s*['"]no-store['"]/)
})

test('trade persistence rejects stale and duplicate closes', async () => {
  const db = await source('src/lib/db.ts')

  assert.match(db, /closeTime\s*<\s*t\.open_time/)
  assert.match(db, /\.eq\(['"]status['"],\s*['"]OPEN['"]\)/)
})

test('a missing BingX position cannot become an opposite market order', async () => {
  const bingx = await source('src/lib/bingx.ts')
  const closeFunction = bingx.match(
    /export async function executeBingxClose[\s\S]*?\n}\n\nexport async function safeExecuteBingxOpen/,
  )?.[0] ?? ''

  assert.match(closeFunction, /position_not_found/)
  assert.doesNotMatch(closeFunction, /BINGX_BTC_QUANTITY|DEFAULT_QUANTITY/)
})

test('production deploy verifies the complete public home', async () => {
  const script = await source('scripts/deploy-prod.sh')

  assert.match(script, /Canales y recursos/)
  assert.match(script, /pagina publica completa/)
})
