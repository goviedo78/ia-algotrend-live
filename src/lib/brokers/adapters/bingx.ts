import { createHmac } from 'node:crypto'
import type { BrokerEnvironment, TradeDirection } from '../domain'
import { normalizeSymbol } from '../domain'
import { BrokerPlatformError } from '../errors'
import type {
  BrokerAdapter,
  BrokerAdapterFactoryInput,
  BrokerFillResult,
  BrokerOrderResult,
  BrokerPosition,
  InstrumentRules,
  PlaceMarketOrderInput,
} from './types'

type QueryValue = string | number | boolean | undefined | null
type BingxPayload = { code?: number | string; msg?: string; data?: unknown }

const HOSTS: Record<BrokerEnvironment, string> = {
  DEMO: 'https://open-api-vst.bingx.com',
  LIVE: 'https://open-api.bingx.com',
}

type SharedCacheEntry<T> = { expiresAt: number; value: Promise<T> }
const instrumentRulesCache = new Map<string, SharedCacheEntry<InstrumentRules>>()
const tickerPriceCache = new Map<string, SharedCacheEntry<number>>()

function sharedCachedValue<T>(
  cache: Map<string, SharedCacheEntry<T>>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
) {
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) return cached.value

  const entry: SharedCacheEntry<T> = { expiresAt: now + ttlMs, value: load() }
  cache.set(key, entry)
  entry.value.catch(() => {
    if (cache.get(key) === entry) cache.delete(key)
  })
  return entry.value
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBingxBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  // BingX no es consistente entre endpoints: algunos devuelven "true"/"false",
  // otros el numérico 1/0 o los strings "1"/"0". Aceptamos todas esas formas.
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return null
}

export function buildBingxQuery(params: Record<string, QueryValue>) {
  return Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

export function signBingxQuery(secret: string, query: string) {
  return createHmac('sha256', secret).update(query).digest('hex')
}

function sanitizeBingxError(payload: BingxPayload, status: number) {
  const brokerCode = String(payload.code ?? status).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
  const retryableCodes = new Set(['100410', '100500', '109500', '110500'])
  const retryable = status >= 500 || status === 429 || retryableCodes.has(brokerCode)
  return new BrokerPlatformError(
    `BINGX_${brokerCode || 'ERROR'}`,
    retryable ? 'BingX no está disponible temporalmente.' : 'BingX rechazó la solicitud.',
    retryable ? 503 : 422,
    retryable,
  )
}

function mapOrder(data: Record<string, unknown>, fallbackClientId: string): BrokerOrderResult {
  const order = (data.order && typeof data.order === 'object' ? data.order : data) as Record<string, unknown>
  const rawStatus = String(order.status ?? 'UNKNOWN').toUpperCase()
  const statuses = new Set(['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'])
  return {
    brokerOrderId: order.orderID ? String(order.orderID) : order.orderId ? String(order.orderId) : null,
    clientOrderId: String(order.clientOrderId ?? order.clientOrderID ?? fallbackClientId),
    status: statuses.has(rawStatus) ? rawStatus as BrokerOrderResult['status'] : 'UNKNOWN',
    filledQuantity: finiteNumber(order.executedQty ?? order.filledQty),
    averagePrice: finiteNumber(order.avgPrice) || null,
    rawStatus: {
      status: rawStatus,
      orderId: order.orderId ? String(order.orderId) : null,
    },
  }
}

export class BingxAdapter implements BrokerAdapter {
  readonly broker = 'BINGX' as const
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly host: string
  private readonly useSharedMarketCache: boolean
  private positionModePromise: Promise<boolean> | null = null

  constructor(private readonly input: BrokerAdapterFactoryInput) {
    this.fetchImpl = input.fetchImpl ?? fetch
    this.now = input.now ?? Date.now
    this.host = HOSTS[input.environment]
    this.useSharedMarketCache = input.fetchImpl === undefined
  }

  private async fetchResponse(url: string, init: RequestInit) {
    try {
      return await this.fetchImpl(url, init)
    } catch {
      throw new BrokerPlatformError('BINGX_NETWORK_ERROR', 'No se pudo contactar a BingX.', 503, true)
    }
  }

  private async request<T extends BingxPayload>(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, QueryValue> = {},
  ): Promise<T> {
    const query = buildBingxQuery({ ...params, recvWindow: 5000, timestamp: this.now() })
    const signature = signBingxQuery(this.input.credentials.secretKey, query)
    const response = await this.fetchResponse(`${this.host}${path}?${query}&signature=${signature}`, {
      method,
      headers: { 'X-BX-APIKEY': this.input.credentials.apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const payload = await response.json().catch(() => ({})) as T
    if (!response.ok || Number(payload.code ?? 0) !== 0) throw sanitizeBingxError(payload, response.status)
    return payload
  }

  async validateCredentials() {
    const balance = await this.getBalance()
    return {
      accountReference: balance.asset || null,
      canRead: true,
      canTradePerpetuals: null,
      balance,
    }
  }

  async getBalance() {
    const payload = await this.request<{
      code?: number
      data?: Array<Record<string, unknown>> | { balance?: Record<string, unknown> }
    }>('GET', '/openApi/swap/v3/user/balance')
    const balance = Array.isArray(payload.data)
      ? payload.data.find((item) => item.asset === 'USDT') ?? payload.data[0] ?? {}
      : payload.data?.balance ?? {}
    return {
      asset: String(balance.asset ?? 'USDT'),
      equity: finiteNumber(balance.equity ?? balance.balance),
      availableMargin: finiteNumber(balance.availableMargin),
      usedMargin: finiteNumber(balance.usedMargin),
    }
  }

  async getPositions(symbol?: string): Promise<BrokerPosition[]> {
    const normalized = symbol ? normalizeSymbol(symbol) : undefined
    const payload = await this.request<{ code?: number; data?: Array<Record<string, unknown>> }>(
      'GET',
      '/openApi/swap/v2/user/positions',
      normalized ? { symbol: normalized } : {},
    )
    return (payload.data ?? [])
      .filter((position) => !normalized || position.symbol === normalized)
      .map((position) => {
        const positionAmount = finiteNumber(position.positionAmt)
        const quantity = Math.abs(positionAmount)
        const positionValue = Math.abs(finiteNumber(position.positionValue))
        const rawDirection = String(position.positionSide ?? '').toUpperCase()
        const direction = ['LONG', 'SHORT'].includes(rawDirection)
          ? rawDirection as TradeDirection
          : positionAmount < 0 ? 'SHORT' : 'LONG'
        return {
          symbol: String(position.symbol),
          direction,
          quantity,
          availableQuantity: Math.abs(finiteNumber(position.availableAmt ?? position.positionAmt)),
          entryPrice: finiteNumber(position.avgPrice),
          markPrice: quantity > 0 && positionValue > 0 ? positionValue / quantity : 0,
          leverage: finiteNumber(position.leverage, 1),
          unrealizedPnl: finiteNumber(position.unrealizedProfit),
        }
      })
      .filter((position) => position.quantity > 0 && ['LONG', 'SHORT'].includes(position.direction))
  }

  async getInstrumentRules(symbol: string): Promise<InstrumentRules> {
    const normalized = normalizeSymbol(symbol)
    const load = async () => {
      const response = await this.fetchResponse(`${this.host}/openApi/swap/v2/quote/contracts`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      const payload = await response.json().catch(() => ({})) as {
        code?: number
        data?: Array<Record<string, unknown>>
      }
      if (!response.ok || Number(payload.code ?? 0) !== 0) throw sanitizeBingxError(payload, response.status)
      const contract = payload.data?.find((item) => item.symbol === normalized)
      if (!contract) throw new BrokerPlatformError('INSTRUMENT_NOT_FOUND', 'El instrumento no existe en BingX.', 422)
      const quantityPrecision = finiteNumber(contract.quantityPrecision)
      return {
        symbol: normalized,
        quantityStep: 10 ** -quantityPrecision,
        minimumQuantity: finiteNumber(contract.tradeMinQuantity),
        maximumQuantity: Number.MAX_SAFE_INTEGER,
        minimumNotional: finiteNumber(contract.tradeMinUSDT),
        pricePrecision: finiteNumber(contract.pricePrecision),
        quantityPrecision,
        openEnabled: Number(contract.status) === 1 && String(contract.apiStateOpen) === 'true',
        closeEnabled: Number(contract.status) === 1 && String(contract.apiStateClose) === 'true',
        maximumLongLeverage: finiteNumber(contract.maxLongLeverage, 1),
        maximumShortLeverage: finiteNumber(contract.maxShortLeverage, 1),
      }
    }
    return this.useSharedMarketCache
      ? sharedCachedValue(instrumentRulesCache, `${this.host}:${normalized}`, 300_000, load)
      : load()
  }

  async getLastPrice(symbol: string) {
    const normalized = normalizeSymbol(symbol)
    const load = async () => {
      const response = await this.fetchResponse(`${this.host}/openApi/swap/v1/ticker/price?symbol=${encodeURIComponent(normalized)}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      const payload = await response.json().catch(() => ({})) as { code?: number; data?: { price?: string } }
      if (!response.ok || Number(payload.code ?? 0) !== 0) throw sanitizeBingxError(payload, response.status)
      const price = finiteNumber(payload.data?.price)
      if (price <= 0) throw new BrokerPlatformError('INVALID_MARKET_PRICE', 'BingX devolvió un precio inválido.', 503, true)
      return price
    }
    return this.useSharedMarketCache
      ? sharedCachedValue(tickerPriceCache, `${this.host}:${normalized}`, 500, load)
      : load()
  }

  async setLeverage(symbol: string, direction: TradeDirection, leverage: number) {
    const hedgeMode = await this.isHedgeMode()
    await this.request('POST', '/openApi/swap/v2/trade/leverage', {
      symbol: normalizeSymbol(symbol),
      side: hedgeMode ? direction : 'BOTH',
      leverage,
    })
  }

  private isHedgeMode() {
    if (!this.positionModePromise) {
      this.positionModePromise = this.request<{ code?: number; data?: { dualSidePosition?: boolean | string | number } }>(
        'GET',
        '/openApi/swap/v1/positionSide/dual',
      ).then((payload) => {
        const hedgeMode = parseBingxBoolean(payload.data?.dualSidePosition)
        if (hedgeMode === null) {
          // Incluimos el valor crudo para diagnosticar si BingX cambia el formato
          // o el campo llega ausente (ej. permiso de API faltante en la clave).
          throw new BrokerPlatformError('BINGX_POSITION_MODE_INVALID', `BingX devolvió un modo de posición inválido: dualSidePosition=${JSON.stringify(payload.data?.dualSidePosition)}`, 503, true)
        }
        return hedgeMode
      }).catch((error) => {
        this.positionModePromise = null
        throw error
      })
    }
    return this.positionModePromise
  }

  async placeMarketOrder(input: PlaceMarketOrderInput) {
    const hedgeMode = await this.isHedgeMode()
    const payload = await this.request<{ code?: number; data?: Record<string, unknown> }>(
      'POST',
      '/openApi/swap/v2/trade/order',
      {
        symbol: normalizeSymbol(input.symbol),
        type: 'MARKET',
        side: input.side,
        positionSide: hedgeMode ? input.direction : 'BOTH',
        quantity: input.quantity,
        reduceOnly: input.reduceOnly && !hedgeMode ? true : undefined,
        clientOrderId: input.clientOrderId,
      },
    )
    return mapOrder(payload.data ?? {}, input.clientOrderId)
  }

  async getOrder(symbol: string, clientOrderId: string) {
    try {
      const payload = await this.request<{ code?: number; data?: Record<string, unknown> }>(
        'GET',
        '/openApi/swap/v2/trade/order',
        { symbol: normalizeSymbol(symbol), clientOrderId },
      )
      if (!payload.data || Object.keys(payload.data).length === 0) return null
      return mapOrder(payload.data, clientOrderId)
    } catch (error) {
      if (error instanceof BrokerPlatformError && error.code === 'BINGX_109421') return null
      throw error
    }
  }

  async getOrderFills(symbol: string, brokerOrderId: string, since: Date): Promise<BrokerFillResult[]> {
    const end = this.now()
    const payload = await this.request<{
      code?: number
      data?: Array<Record<string, unknown>> | { fills?: Array<Record<string, unknown>> }
    }>('GET', '/openApi/swap/v2/trade/allFillOrders', {
      symbol: normalizeSymbol(symbol),
      tradingUnit: 'COIN',
      startTs: Math.max(since.getTime() - 60_000, end - 7 * 24 * 60 * 60 * 1000),
      endTs: end,
      orderId: brokerOrderId,
      currency: 'USDT',
    })
    const fills = Array.isArray(payload.data) ? payload.data : payload.data?.fills ?? []
    return fills.map((fill) => ({
      brokerFillId: String(fill.tradeId),
      quantity: Math.abs(finiteNumber(fill.qty)),
      price: finiteNumber(fill.price),
      fee: finiteNumber(fill.fee),
      feeAsset: String(fill.currency ?? 'USDT'),
      realizedPnl: finiteNumber(fill.realizedPnl),
      filledAt: new Date(finiteNumber(fill.time, end)).toISOString(),
    })).filter((fill) => fill.brokerFillId !== 'undefined' && fill.quantity > 0 && fill.price > 0)
  }
}
