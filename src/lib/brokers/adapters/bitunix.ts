import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { normalizeSymbol, type TradeDirection } from '../domain'
import { BrokerPlatformError } from '../errors'
import { DEFAULT_BITUNIX_TAKER_FEE_RATE } from '../funding-requirement'
import { runtimeFlag } from '../runtime'
import type { BrokerAdapter, BrokerAdapterFactoryInput, BrokerFillResult, BrokerOrderResult, BrokerPosition, InstrumentRules, PlaceMarketOrderInput } from './types'

// Fixed destination: credentials are never sent to a user-supplied host or a proxy.
const HOST = 'https://fapi.bitunix.com'
type Row = Record<string, unknown>
type Params = Record<string, string | number | boolean>
type CacheEntry<T> = { expiresAt: number; value: Promise<T> }
const prices = new Map<string, CacheEntry<number>>()
const contracts = new Map<string, CacheEntry<InstrumentRules>>()

function cached<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number, load: () => Promise<T>) {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) return entry.value
  const next = { expiresAt: Date.now() + ttl, value: load() }
  cache.set(key, next)
  next.value.catch(() => { if (cache.get(key) === next) cache.delete(key) })
  return next.value
}

function invalidResponse(): never {
  throw new BrokerPlatformError('BITUNIX_INVALID_RESPONSE', 'Bitunix devolvió una respuesta incompleta o inválida.', 503, true)
}
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  return value as Row
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return invalidResponse()
  return value.map(row)
}
function number(value: unknown) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return invalidResponse()
  const result = Number(value)
  if (!Number.isFinite(result)) return invalidResponse()
  return result
}
function positionDirection(side: unknown): TradeDirection {
  if (side === 'BUY' || side === 'LONG') return 'LONG'
  if (side === 'SELL' || side === 'SHORT') return 'SHORT'
  return invalidResponse()
}
function id(value: unknown): string {
  // Never round exchange int64 identifiers. The documented API returns strings.
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return invalidResponse()
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value)) return invalidResponse()
  return String(value)
}

export function bitunixSymbol(symbol: string) {
  const result = normalizeSymbol(symbol).replace(/[-_]/g, '')
  if (!/^[A-Z0-9]{3,40}USDT$/.test(result)) {
    throw new BrokerPlatformError('BITUNIX_SYMBOL_INVALID', 'Bitunix requiere un contrato de futuros USDT.', 422)
  }
  return result
}

export function signBitunixRequest(secret: string, apiKey: string, nonce: string, timestamp: string, params: Params, body = '') {
  const query = Object.keys(params).sort().map(key => key + String(params[key])).join('')
  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
  return sha256(sha256(nonce + timestamp + apiKey + query + body) + secret)
}

async function request(
  fetchImpl: typeof fetch, method: 'GET' | 'POST', path: string, params: Params = {},
  auth?: { credentials: BrokerAdapterFactoryInput['credentials']; now: () => number },
) {
  const body = method === 'POST' ? JSON.stringify(params) : ''
  const query = method === 'GET' ? new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString() : ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const nonce = randomBytes(16).toString('hex')
    const timestamp = String(auth.now())
    Object.assign(headers, {
      'api-key': auth.credentials.apiKey, nonce, timestamp,
      sign: signBitunixRequest(auth.credentials.secretKey, auth.credentials.apiKey, nonce, timestamp, method === 'GET' ? params : {}, body),
    })
  }
  let response: Response
  try {
    response = await fetchImpl(`${HOST}${path}${query ? `?${query}` : ''}`, {
      method, headers, body: body || undefined, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new BrokerPlatformError('BITUNIX_NETWORK_ERROR', 'No se pudo contactar a Bitunix.', 503, true)
  }
  const payload = await response.json().catch(() => null)
  const code = payload && typeof payload === 'object' ? payload.code : undefined
  if (response.ok && (code === undefined || code === null)) return invalidResponse()
  if (!response.ok || (code !== 0 && code !== '0')) {
    const safeCode = String(code ?? response.status).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
    const retryable = response.status >= 500 || response.status === 429 || ['10001', '10005', '10006', '10009', '30042'].includes(safeCode)
    // No raw upstream message, response or request headers in logs/audit/UI.
    throw new BrokerPlatformError(`BITUNIX_${safeCode}`, retryable ? 'Bitunix no está disponible temporalmente.' : 'Bitunix rechazó la solicitud.', retryable ? 503 : 422, retryable)
  }
  return payload.data as unknown
}

export function fetchBitunixTickerPrice(symbol: string, options: { fetchImpl?: typeof fetch; ttlMs?: number } = {}) {
  const exchangeSymbol = bitunixSymbol(symbol)
  const load = async () => {
    const data = rows(await request(options.fetchImpl ?? fetch, 'GET', '/api/v1/futures/market/tickers', { symbols: exchangeSymbol }))
    const ticker = data.find(item => item.symbol === exchangeSymbol)
    const price = number(ticker?.lastPrice)
    if (price <= 0) return invalidResponse()
    return price
  }
  return options.fetchImpl ? load() : cached(prices, `${exchangeSymbol}:${options.ttlMs ?? 500}`, options.ttlMs ?? 500, load)
}

function mapOrder(value: unknown, clientOrderId: string, symbol: string, submitted = false): BrokerOrderResult {
  const data = row(value)
  if (data.clientId !== undefined && String(data.clientId) !== clientOrderId) return invalidResponse()
  if (data.symbol !== undefined && data.symbol !== bitunixSymbol(symbol)) return invalidResponse()
  const status = String(data.status ?? (submitted ? 'NEW' : 'UNKNOWN'))
  const statuses: Record<string, BrokerOrderResult['status']> = {
    INIT: 'NEW', NEW: 'NEW', PART_FILLED: 'PARTIALLY_FILLED', FILLED: 'FILLED', CANCELED: 'CANCELED',
  }
  if (!submitted && !statuses[status]) return invalidResponse()
  const filledQuantity = submitted && data.tradeQty === undefined ? 0 : number(data.tradeQty)
  if (filledQuantity < 0) return invalidResponse()
  return {
    brokerOrderId: id(data.orderId), clientOrderId, status: statuses[status] ?? 'UNKNOWN',
    filledQuantity,
    // `price` in get_order_detail is the limit price, not the fill average.
    averagePrice: null,
    realizedPnl: data.realizedPNL === undefined ? undefined : number(data.realizedPNL),
    fee: data.fee === undefined ? undefined : number(data.fee), feeAsset: 'USDT',
    rawStatus: { status, orderId: id(data.orderId) },
  }
}

export class BitunixAdapter implements BrokerAdapter {
  readonly broker = 'BITUNIX' as const
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private positionModePromise: Promise<'ONE_WAY' | 'HEDGE'> | null = null

  constructor(private readonly input: BrokerAdapterFactoryInput) {
    if (input.environment !== 'LIVE') {
      throw new BrokerPlatformError('BITUNIX_DEMO_UNSUPPORTED', 'Bitunix sólo está disponible para cuentas reales.', 422)
    }
    this.fetchImpl = input.fetchImpl ?? fetch
    this.now = input.now ?? Date.now
  }

  private request(method: 'GET' | 'POST', path: string, params: Params = {}) {
    return request(this.fetchImpl, method, path, params, { credentials: this.input.credentials, now: this.now })
  }
  private assertExecutionEnabled() {
    if (!runtimeFlag('BITUNIX_EXECUTION_ENABLED')) {
      throw new BrokerPlatformError('BITUNIX_EXECUTION_DISABLED', 'Las órdenes de Bitunix todavía no están habilitadas.', 503, true)
    }
  }

  async validateCredentials() {
    const balance = await this.getBalance()
    await this.positionMode()
    return { accountReference: null, canRead: true, canTradePerpetuals: null, balance }
  }

  async getBalance() {
    const payload = await this.request('GET', '/api/v1/futures/account', { marginCoin: 'USDT' })
    // The live API returns an object; the official example returns an array.
    const data = Array.isArray(payload) ? rows(payload) : [row(payload)]
    const balance = data.find(item => item.marginCoin === 'USDT')
    if (!balance) return invalidResponse()
    const available = number(balance.available)
    const margin = number(balance.margin)
    const frozen = number(balance.frozen)
    const cross = number(balance.crossUnrealizedPNL)
    const isolated = number(balance.isolationUnrealizedPNL)
    return { asset: 'USDT', equity: available + frozen + margin + cross + isolated, availableMargin: Math.max(0, available + cross), usedMargin: margin + frozen }
  }

  async getCommissionRates() {
    // No account commission endpoint in the published futures API. Reserve the
    // standard VIP0 fee; actual accounting always comes from exchange fills.
    return { taker: DEFAULT_BITUNIX_TAKER_FEE_RATE, maker: 0.0002 }
  }

  private async rawPositions(symbol?: string) {
    return rows(await this.request('GET', '/api/v1/futures/position/get_pending_positions', {
      ...(symbol ? { symbol: bitunixSymbol(symbol) } : {}), includeSubAccounts: false,
    }))
  }

  async getPositions(symbol?: string): Promise<BrokerPosition[]> {
    const data = await this.rawPositions(symbol)
    return data.filter(item => !symbol || item.symbol === bitunixSymbol(symbol)).map(item => {
      const quantity = number(item.qty)
      const entryPrice = number(item.avgOpenPrice)
      const unrealizedPnl = number(item.unrealizedPNL)
      const direction = positionDirection(item.side)
      if (quantity < 0) return invalidResponse()
      const exchangeSymbol = String(item.symbol)
      if (bitunixSymbol(exchangeSymbol) !== exchangeSymbol) return invalidResponse()
      const canonicalSymbol = `${exchangeSymbol.slice(0, -4)}-USDT`
      // Linear USDT futures: PnL = qty * (mark - entry) with the side's sign.
      const markPrice = quantity > 0 ? entryPrice + unrealizedPnl / quantity * (direction === 'LONG' ? 1 : -1) : entryPrice
      if (quantity > 0 && markPrice <= 0) return invalidResponse()
      return { symbol: symbol ? normalizeSymbol(symbol) : canonicalSymbol, direction, quantity, availableQuantity: quantity, entryPrice, markPrice, leverage: number(item.leverage), unrealizedPnl }
    }).filter(item => item.quantity > 0)
  }

  async getInstrumentRules(symbol: string): Promise<InstrumentRules> {
    const exchangeSymbol = bitunixSymbol(symbol)
    const load = async () => {
      const data = rows(await request(this.fetchImpl, 'GET', '/api/v1/futures/market/trading_pairs', { symbols: exchangeSymbol }))
      const contract = data.find(item => item.symbol === exchangeSymbol)
      if (!contract) throw new BrokerPlatformError('INSTRUMENT_NOT_FOUND', 'El instrumento no existe en Bitunix.', 422)
      const quantityPrecision = number(contract.basePrecision)
      const pricePrecision = number(contract.quotePrecision)
      const minimumQuantity = number(contract.minTradeVolume)
      const maximumQuantity = number(contract.maxMarketOrderVolume)
      const maximumLeverage = number(contract.maxLeverage)
      if (!Number.isInteger(quantityPrecision) || quantityPrecision < 0 || quantityPrecision > 12 || !Number.isInteger(pricePrecision) || pricePrecision < 0 || pricePrecision > 12 || minimumQuantity <= 0 || maximumQuantity < minimumQuantity || maximumLeverage < 1) return invalidResponse()
      const enabled = contract.symbolStatus === 'OPEN' && contract.isApiSupported === true
      return { symbol: normalizeSymbol(symbol), quantityStep: 10 ** -quantityPrecision, minimumQuantity, maximumQuantity, minimumNotional: 0, pricePrecision, quantityPrecision, openEnabled: enabled, closeEnabled: enabled, maximumLongLeverage: maximumLeverage, maximumShortLeverage: maximumLeverage }
    }
    // Canonical symbol is included so callers never receive a differently formatted symbol.
    return this.input.fetchImpl ? load() : cached(contracts, normalizeSymbol(symbol), 300_000, load)
  }

  getLastPrice(symbol: string) {
    return fetchBitunixTickerPrice(symbol, { fetchImpl: this.input.fetchImpl })
  }

  private positionMode() {
    if (!this.positionModePromise) {
      this.positionModePromise = this.request('GET', '/api/v1/futures/account/position_mode').then(data => {
        const mode = row(data).positionMode
        if (mode !== 'ONE_WAY' && mode !== 'HEDGE') return invalidResponse()
        return mode
      }).catch(error => { this.positionModePromise = null; throw error })
    }
    return this.positionModePromise
  }

  async setLeverage(symbol: string, _direction: TradeDirection, leverage: number) {
    this.assertExecutionEnabled()
    await this.request('POST', '/api/v1/futures/account/change_leverage', { symbol: bitunixSymbol(symbol), marginCoin: 'USDT', leverage })
  }

  async placeMarketOrder(input: PlaceMarketOrderInput) {
    this.assertExecutionEnabled()
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) return invalidResponse()
    const mode = await this.positionMode()
    const params: Params = { symbol: bitunixSymbol(input.symbol), qty: String(input.quantity), side: input.side, orderType: 'MARKET', clientId: input.clientOrderId }
    if (mode === 'ONE_WAY') {
      params.reduceOnly = input.reduceOnly
    } else {
      // Bitunix hedge CLOSE uses the ORIGINAL position side (LONG=BUY, SHORT=SELL),
      // unlike BingX. The exact positionId is mandatory; never use close-all.
      params.side = input.direction === 'LONG' ? 'BUY' : 'SELL'
      params.tradeSide = input.reduceOnly ? 'CLOSE' : 'OPEN'
      if (input.reduceOnly) {
        const matches = (await this.rawPositions(input.symbol)).filter(item => item.symbol === params.symbol && positionDirection(item.side) === input.direction && number(item.qty) > 0)
        if (matches.length !== 1 || number(matches[0].qty) + 1e-12 < input.quantity) {
          throw new BrokerPlatformError('BITUNIX_CLOSE_POSITION_MISMATCH', 'No se pudo identificar una única posición para el cierre autorizado.', 409)
        }
        params.positionId = id(matches[0].positionId)
      }
    }
    const data = await this.request('POST', '/api/v1/futures/trade/place_order', params)
    return mapOrder(data, input.clientOrderId, input.symbol, true)
  }

  async getOrder(symbol: string, clientOrderId: string) {
    try {
      return mapOrder(await this.request('GET', '/api/v1/futures/trade/get_order_detail', { clientId: clientOrderId }), clientOrderId, symbol)
    } catch (error) {
      if (error instanceof BrokerPlatformError && error.code === 'BITUNIX_20007') return null
      throw error
    }
  }

  async getOrderFills(symbol: string, brokerOrderId: string, since: Date, clientOrderId?: string): Promise<BrokerFillResult[]> {
    const result: BrokerFillResult[] = []
    const seen = new Set<string>()
    const endTime = this.now()
    // Bounded pagination: never silently account only the first page of a split fill.
    for (let page = 0; page < 10; page++) {
      const data = row(await this.request('GET', '/api/v1/futures/trade/get_history_trades', { symbol: bitunixSymbol(symbol), orderId: brokerOrderId, startTime: Math.max(0, since.getTime() - 60_000), endTime, skip: page * 100, limit: 100 }))
      const trades = rows(data.tradeList)
      for (const trade of trades) {
        if (id(trade.orderId) !== brokerOrderId || trade.symbol !== bitunixSymbol(symbol)) continue
        // The live endpoint can omit clientId or return null/empty. Exact orderId
        // and symbol above remain mandatory; a nonempty foreign clientId is rejected.
        if (clientOrderId && trade.clientId != null && trade.clientId !== '' && trade.clientId !== clientOrderId) continue
        const brokerFillId = id(trade.tradeId)
        if (seen.has(brokerFillId)) continue
        const quantity = number(trade.qty)
        const price = number(trade.price)
        const filledAt = number(trade.ctime)
        if (quantity <= 0 || price <= 0 || filledAt <= 0 || filledAt > 8.64e15) return invalidResponse()
        seen.add(brokerFillId)
        result.push({ brokerFillId, quantity, price, notionalUsd: quantity * price, fee: number(trade.fee), feeAsset: 'USDT', realizedPnl: number(trade.realizedPNL), filledAt: new Date(filledAt).toISOString() })
      }
      if (trades.length < 100 || (data.total !== undefined && (page + 1) * 100 >= number(data.total))) return result
    }
    throw new BrokerPlatformError('BITUNIX_FILLS_PAGE_LIMIT', 'La orden requiere más páginas de ejecuciones para conciliarse.', 503, true)
  }
}
