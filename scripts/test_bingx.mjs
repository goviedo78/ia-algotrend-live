// Diagnóstico BingX + algotrend_events. Lee env de process.env (vercel env pull).
// NO imprime claves. NO commitear el .env.local que se genere para correr esto.

import crypto from 'node:crypto'

const apiKey = process.env.BINGX_API_KEY?.trim()
const secretKey = process.env.BINGX_SECRET_KEY?.trim()
const useDemo = process.env.BINGX_USE_DEMO !== 'false'
const baseUrl = useDemo ? 'https://open-api-vst.bingx.com' : 'https://open-api.bingx.com'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('--- Config check ---')
console.log('BINGX_API_KEY present:', !!apiKey, 'length:', apiKey?.length ?? 0)
console.log('BINGX_SECRET_KEY present:', !!secretKey, 'length:', secretKey?.length ?? 0)
console.log('BINGX_USE_DEMO:', useDemo, '→ baseUrl:', baseUrl)
console.log('SUPABASE present:', !!supabaseUrl && !!serviceKey)
console.log()

// -------- 1. Logs de Supabase: últimos events de bingx ----------
async function fetchRecentBingxEvents() {
  if (!supabaseUrl || !serviceKey) {
    console.log('[skip] Supabase: no creds')
    return
  }
  console.log('--- Últimos 10 eventos bingx_* en algotrend_events ---')
  const url = `${supabaseUrl}/rest/v1/algotrend_events?event_type=in.(bingx_order_open,bingx_order_close,bingx_order_fail)&order=created_at.desc&limit=10`
  try {
    const res = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (!res.ok) {
      console.log('  ERROR query:', res.status, await res.text())
      return
    }
    const rows = await res.json()
    if (!rows.length) {
      console.log('  ⚠️ NINGUN evento bingx en la tabla → el código nunca llamó executeBingxOpen/Close')
      return
    }
    for (const r of rows) {
      const md = r.metadata || {}
      const summary = r.event_type === 'bingx_order_fail'
        ? `tradeId=${md.tradeId} action=${md.action} error=${String(md.error).slice(0, 200)}`
        : `tradeId=${md.tradeId} dir=${md.direction} demo=${md.demo} resultCode=${md.result?.code ?? '?'}`
      console.log(`  [${r.created_at}] ${r.event_type} :: ${summary}`)
    }
  } catch (e) {
    console.log('  EXCEPCION:', e.message)
  }
}

// -------- 2. Llamada directa a BingX /positions ----------
async function testBingxPositions() {
  if (!apiKey || !secretKey) {
    console.log('\n[skip] BingX: no creds locales (corrér después de "vercel env pull")')
    return
  }
  console.log('\n--- Test directo BingX /openApi/swap/v2/user/positions ---')
  const params = { timestamp: Date.now(), recvWindow: 10000 }
  const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  const signature = crypto.createHmac('sha256', secretKey).update(query).digest('hex')
  const url = `${baseUrl}/openApi/swap/v2/user/positions?${query}&signature=${signature}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'X-BX-APIKEY': apiKey },
    })
    const body = await res.json()
    console.log('  HTTP status:', res.status)
    console.log('  BingX code:', body.code, '| msg:', body.msg)
    if (body.code === 0) {
      const btc = (body.data ?? []).filter(p => p.symbol === 'BTC-USDT')
      console.log('  ✅ Keys válidas. Posiciones BTC-USDT:', btc.length)
      btc.forEach(p => console.log(`     - ${p.positionSide} amt=${p.positionAmt} avail=${p.availableAmt}`))
    } else {
      console.log('  ❌ BingX rechazó la request. Body completo (sanitizado):')
      console.log('  ', JSON.stringify(body).slice(0, 400))
    }
  } catch (e) {
    console.log('  EXCEPCION:', e.message)
  }
}

await fetchRecentBingxEvents()
await testBingxPositions()
