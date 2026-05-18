import { logEvent } from '@/lib/analytics'
import type { Trade } from '@/lib/db'

type BingxSide = 'BUY' | 'SELL'
type BingxPositionSide = 'LONG' | 'SHORT'

const SYMBOL = 'BTC-USDT'
const DEFAULT_QUANTITY = '0.0001'
const RECV_WINDOW = '10000'

function isEnabled() {
  return process.env.BINGX_TRADING_ENABLED === 'true'
}

function baseUrl() {
  return process.env.BINGX_USE_DEMO === 'false'
    ? 'https://open-api.bingx.com'
    : 'https://open-api-vst.bingx.com'
}

function getConfig() {
  const apiKey = process.env.BINGX_API_KEY?.trim()
  const secretKey = process.env.BINGX_SECRET_KEY?.trim()
  if (!apiKey || !secretKey) return null
  return { apiKey, secretKey }
}

async function hmacSha256(secret: string, payload: string) {
  const crypto = await import('crypto')
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

async function signedRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {}
) {
  const config = getConfig()
  if (!config) throw new Error('BingX credentials are not configured')

  const query = buildQuery({
    ...params,
    timestamp: Date.now(),
    recvWindow: RECV_WINDOW,
  })
  const signature = await hmacSha256(config.secretKey, query)
  const url = `${baseUrl()}${path}?${query}&signature=${signature}`

  const response = await fetch(url, {
    method,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'X-BX-APIKEY': config.apiKey,
    },
    cache: 'no-store',
  })

  const json = await response.json() as T & { code?: number | string; msg?: string }
  if (!response.ok || Number(json.code ?? 0) !== 0) {
    throw new Error(`BingX ${path} failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`)
  }
  return json
}

async function setLeverage(positionSide: BingxPositionSide) {
  return signedRequest('POST', '/openApi/swap/v2/trade/leverage', {
    symbol: SYMBOL,
    side: positionSide,
    leverage: process.env.BINGX_LEVERAGE?.trim() || '1',
  })
}

async function placeMarketOrder(
  side: BingxSide,
  positionSide: BingxPositionSide,
  clientOrderID: string,
  quantity = process.env.BINGX_BTC_QUANTITY?.trim() || DEFAULT_QUANTITY
) {
  return signedRequest('POST', '/openApi/swap/v2/trade/order', {
    symbol: SYMBOL,
    type: 'MARKET',
    side,
    positionSide,
    quantity,
    clientOrderID,
  })
}

async function getBtcPositions() {
  const response = await signedRequest<{
    data?: Array<{
      symbol?: string
      positionSide?: BingxPositionSide
      positionAmt?: string
      availableAmt?: string
    }>
  }>('GET', '/openApi/swap/v2/user/positions')

  return (response.data ?? []).filter((position) => position.symbol === SYMBOL)
}

function orderClientId(prefix: string, trade: Trade) {
  return `${prefix}-${trade.id}-${trade.signal_time}`.slice(0, 40)
}

export async function executeBingxOpen(trade: Trade) {
  if (!isEnabled()) return { skipped: true, reason: 'disabled' }

  const positionSide: BingxPositionSide = trade.direction
  const side: BingxSide = trade.direction === 'LONG' ? 'BUY' : 'SELL'
  await setLeverage(positionSide)
  const result = await placeMarketOrder(side, positionSide, orderClientId('at-open', trade))

  await logEvent('bingx_order_open', {
    tradeId: trade.id,
    direction: trade.direction,
    symbol: SYMBOL,
    demo: process.env.BINGX_USE_DEMO !== 'false',
    result,
  })

  return result
}

export async function executeBingxClose(trade: Trade) {
  if (!isEnabled()) return { skipped: true, reason: 'disabled' }

  const positionSide: BingxPositionSide = trade.direction
  const side: BingxSide = trade.direction === 'LONG' ? 'SELL' : 'BUY'
  const positions = await getBtcPositions()
  const position = positions.find((item) => item.positionSide === positionSide)
  const quantity = position?.availableAmt || position?.positionAmt || process.env.BINGX_BTC_QUANTITY?.trim() || DEFAULT_QUANTITY

  const result = await placeMarketOrder(side, positionSide, orderClientId('at-close', trade), quantity)

  await logEvent('bingx_order_close', {
    tradeId: trade.id,
    direction: trade.direction,
    symbol: SYMBOL,
    quantity,
    demo: process.env.BINGX_USE_DEMO !== 'false',
    result,
  })

  return result
}

export async function safeExecuteBingxOpen(trade: Trade, actions?: string[]) {
  try {
    const result = await executeBingxOpen(trade)
    actions?.push(result && 'skipped' in result ? 'bingx_open_skipped' : 'bingx_open_sent')
    return result
  } catch (err) {
    actions?.push('bingx_open_failed')
    await logEvent('bingx_order_fail', { tradeId: trade.id, action: 'open', error: String(err) })
    console.error('[bingx open]', err)
    return null
  }
}

export async function safeExecuteBingxClose(trade: Trade, actions?: string[]) {
  try {
    const result = await executeBingxClose(trade)
    actions?.push(result && 'skipped' in result ? 'bingx_close_skipped' : 'bingx_close_sent')
    return result
  } catch (err) {
    actions?.push('bingx_close_failed')
    await logEvent('bingx_order_fail', { tradeId: trade.id, action: 'close', error: String(err) })
    console.error('[bingx close]', err)
    return null
  }
}
