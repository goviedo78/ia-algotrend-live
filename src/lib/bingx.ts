import { logEvent } from '@/lib/analytics'
import { BingxAdapter } from '@/lib/brokers/adapters/bingx'
import type { BrokerAdapter, BrokerOrderResult } from '@/lib/brokers/adapters/types'
import { BrokerPlatformError } from '@/lib/brokers/errors'
import type { Trade } from '@/lib/db'
import {
  beginLegacyBingxExecution,
  completeLegacyBingxExecution,
  failLegacyBingxExecution,
  getLegacyBingxExecution,
} from '@/lib/legacy-bingx-ledger'
import { createAdminClient } from '@/lib/supabase/admin'

type BingxPositionSide = 'LONG' | 'SHORT'
export type BingxExecutionSource = 'cron' | 'webhook' | 'signal'

const SYMBOL = 'BTC-USDT'
const DEFAULT_QUANTITY = '0.0001'
const RECV_WINDOW = '10000'
const AUDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 - 1
const MAX_AUDIT_RANGE_MS = 90 * 24 * 60 * 60 * 1000

function envFlag(name: string) {
  return process.env[name]?.replace(/\\n/g, '').trim().toLowerCase() === 'true'
}

export function isLegacyBingxEnabled() {
  return envFlag('BINGX_LEGACY_EXECUTION_ENABLED')
    && envFlag('BINGX_TRADING_ENABLED')
}

function isSourceAllowed(source: BingxExecutionSource) {
  const allowed = process.env.BINGX_ALLOWED_EXECUTION_SOURCES?.trim() || 'cron'
  return allowed.split(',').map((item) => item.trim()).includes(source)
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

function getLegacyAdapter() {
  const credentials = getConfig()
  if (!credentials) {
    throw new BrokerPlatformError(
      'BINGX_CREDENTIALS_MISSING',
      'Las credenciales directas de BingX no están configuradas.',
      503,
    )
  }
  return new BingxAdapter({
    credentials,
    environment: process.env.BINGX_USE_DEMO === 'false' ? 'LIVE' : 'DEMO',
  })
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

async function assertOpenRiskLimits(adapter: BrokerAdapter, price: number, quantity: number) {
  const notional = price * quantity
  const maxNotional = Number(process.env.BINGX_MAX_NOTIONAL_USDT?.trim() || '8')
  const minAvailable = Number(process.env.BINGX_MIN_AVAILABLE_MARGIN_USDT?.trim() || '20')

  if (!Number.isFinite(notional) || notional <= 0) {
    throw new Error(`BingX risk guard: invalid notional for quantity ${quantity}`)
  }

  if (Number.isFinite(maxNotional) && maxNotional > 0 && notional > maxNotional) {
    throw new Error(`BingX risk guard: notional ${notional.toFixed(4)} USDT exceeds max ${maxNotional} USDT`)
  }

  const balance = await adapter.getBalance()
  const availableMargin = Number(balance.availableMargin)
  if (Number.isFinite(minAvailable) && minAvailable > 0 && availableMargin < minAvailable) {
    throw new Error(`BingX risk guard: available margin ${availableMargin.toFixed(4)} USDT below minimum ${minAvailable} USDT`)
  }
}

type BingxFillRecord = {
  tradeId?: string | number
  symbol?: string
  orderId?: string | number
  side?: string
  price?: string | number
  qty?: string | number
  realizedPnl?: string | number
  fee?: string | number
  currency?: string
  time?: string | number
}

type BingxIncomeRecord = {
  symbol?: string
  incomeType?: string
  income?: string | number
  asset?: string
  info?: string
  time?: string | number
  tranId?: string | number
  tradeId?: string | number
}

type BingxOpenOrderRecord = {
  orderId?: string | number
  clientOrderId?: string
  side?: string
  positionSide?: string
  type?: string
  status?: string
  origQty?: string | number
  executedQty?: string | number
}

function auditWindows(startTime: number, endTime: number) {
  const windows: Array<{ startTs: number; endTs: number }> = []
  for (let startTs = startTime; startTs <= endTime; startTs += AUDIT_WINDOW_MS + 1) {
    windows.push({
      startTs,
      endTs: Math.min(endTime, startTs + AUDIT_WINDOW_MS),
    })
  }
  return windows
}

function waitForAuditRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, 550))
}

function normalizeFill(record: BingxFillRecord) {
  return {
    tradeId: String(record.tradeId ?? ''),
    symbol: String(record.symbol ?? ''),
    orderId: String(record.orderId ?? ''),
    side: String(record.side ?? ''),
    price: Number(record.price ?? 0),
    quantity: Math.abs(Number(record.qty ?? 0)),
    realizedPnl: Number(record.realizedPnl ?? 0),
    fee: Number(record.fee ?? 0),
    feeAsset: String(record.currency ?? 'USDT'),
    time: Number(record.time ?? 0),
  }
}

function normalizeIncome(record: BingxIncomeRecord) {
  return {
    symbol: String(record.symbol ?? ''),
    incomeType: String(record.incomeType ?? ''),
    income: Number(record.income ?? 0),
    asset: String(record.asset ?? ''),
    info: String(record.info ?? ''),
    time: Number(record.time ?? 0),
    tranId: String(record.tranId ?? ''),
    tradeId: String(record.tradeId ?? ''),
  }
}

export async function getLegacyBingxAudit(startTime: number, endTime: number) {
  if (
    !Number.isSafeInteger(startTime)
    || !Number.isSafeInteger(endTime)
    || startTime <= 0
    || endTime < startTime
    || endTime - startTime > MAX_AUDIT_RANGE_MS
  ) {
    throw new Error('Invalid legacy BingX audit range')
  }

  const fills: ReturnType<typeof normalizeFill>[] = []
  for (const [index, window] of auditWindows(startTime, endTime).entries()) {
    if (index > 0) await waitForAuditRateLimit()
    const response = await signedRequest<{
      data?: BingxFillRecord[] | { fills?: BingxFillRecord[] }
    }>('GET', '/openApi/swap/v2/trade/allFillOrders', {
      symbol: SYMBOL,
      tradingUnit: 'COIN',
      startTs: window.startTs,
      endTs: window.endTs,
      currency: 'USDT',
    })
    const records = Array.isArray(response.data) ? response.data : response.data?.fills ?? []
    fills.push(...records.map(normalizeFill))
  }

  await waitForAuditRateLimit()
  const incomeResponse = await signedRequest<{ data?: BingxIncomeRecord[] }>(
    'GET',
    '/openApi/swap/v2/user/income',
    {
      symbol: SYMBOL,
      startTime,
      endTime,
      limit: 1000,
    },
  )
  await waitForAuditRateLimit()
  const commissionResponse = await signedRequest<{
    data?: {
      commission?: {
        takerCommissionRate?: string | number
        makerCommissionRate?: string | number
      }
    }
  }>('GET', '/openApi/swap/v2/user/commissionRate')
  await waitForAuditRateLimit()
  const adapter = getLegacyAdapter()
  const [balance, accountPositions, openOrdersResponse] = await Promise.all([
    adapter.getBalance(),
    adapter.getPositions(),
    signedRequest<{
      data?: BingxOpenOrderRecord[] | { orders?: BingxOpenOrderRecord[] }
    }>('GET', '/openApi/swap/v2/trade/openOrders', { symbol: SYMBOL }),
  ])
  const positions = accountPositions.filter((position) => position.symbol === SYMBOL)
  const openOrders = Array.isArray(openOrdersResponse.data)
    ? openOrdersResponse.data
    : openOrdersResponse.data?.orders ?? []

  return {
    symbol: SYMBOL,
    environment: process.env.BINGX_USE_DEMO === 'false' ? 'live' : 'demo',
    legacyExecutionEnabled: envFlag('BINGX_LEGACY_EXECUTION_ENABLED'),
    globalTradingEnabled: envFlag('BINGX_TRADING_ENABLED'),
    tradingEnabled: isLegacyBingxEnabled(),
    startTime,
    endTime,
    commission: {
      takerRate: Number(commissionResponse.data?.commission?.takerCommissionRate ?? 0),
      makerRate: Number(commissionResponse.data?.commission?.makerCommissionRate ?? 0),
    },
    balance,
    accountPositions,
    openOrders: openOrders.map((order) => ({
      orderId: String(order.orderId ?? ''),
      clientOrderId: String(order.clientOrderId ?? ''),
      side: String(order.side ?? ''),
      positionSide: String(order.positionSide ?? ''),
      type: String(order.type ?? ''),
      status: String(order.status ?? ''),
      quantity: Number(order.origQty ?? 0),
      executedQuantity: Number(order.executedQty ?? 0),
    })),
    fills: fills
      .filter((fill) => fill.symbol === SYMBOL && fill.time >= startTime && fill.time <= endTime)
      .sort((left, right) => left.time - right.time),
    income: (incomeResponse.data ?? [])
      .map(normalizeIncome)
      .filter((record) => record.symbol === SYMBOL && record.time >= startTime && record.time <= endTime)
      .sort((left, right) => left.time - right.time),
    positions,
  }
}

export function legacyOrderClientId(prefix: 'at-open' | 'at-close', trade: Pick<Trade, 'id' | 'signal_time'>) {
  return `${prefix}-${trade.id}-${trade.signal_time}`.slice(0, 40)
}

function configuredQuantity() {
  const quantity = Number(process.env.BINGX_BTC_QUANTITY?.trim() || DEFAULT_QUANTITY)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BrokerPlatformError('BINGX_QUANTITY_INVALID', 'El lotaje directo de BTC es inválido.', 503)
  }
  return quantity
}

function configuredLeverage() {
  const leverage = Number(process.env.BINGX_LEVERAGE?.trim() || '1')
  if (!Number.isSafeInteger(leverage) || leverage < 1) {
    throw new BrokerPlatformError('BINGX_LEVERAGE_INVALID', 'El apalancamiento directo es inválido.', 503)
  }
  return leverage
}

function errorDetails(error: unknown) {
  if (error instanceof BrokerPlatformError) {
    return { code: error.code, message: error.message, retryable: error.retryable }
  }
  return {
    code: 'BINGX_LEGACY_INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unknown legacy BingX error',
    retryable: false,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForFilledOrder(
  adapter: BrokerAdapter,
  clientOrderId: string,
  initial: BrokerOrderResult | null,
) {
  let order = initial
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (order?.status === 'FILLED' && order.filledQuantity > 0) return order
    if (order && ['CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)) {
      throw new BrokerPlatformError(
        `BINGX_ORDER_${order.status}`,
        `BingX terminó la orden con estado ${order.status}.`,
        422,
      )
    }
    await wait(250 * (attempt + 1))
    order = await adapter.getOrder(SYMBOL, clientOrderId)
  }
  throw new BrokerPlatformError(
    'BINGX_ORDER_CONFIRMATION_PENDING',
    'BingX aceptó la orden pero todavía no confirmó el fill.',
    503,
    true,
  )
}

export async function submitIdempotentBingxMarketOrder(
  adapter: BrokerAdapter,
  input: {
    direction: BingxPositionSide
    side: 'BUY' | 'SELL'
    quantity: number
    reduceOnly: boolean
    clientOrderId: string
  },
) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await adapter.getOrder(SYMBOL, input.clientOrderId)
    if (existing) return waitForFilledOrder(adapter, input.clientOrderId, existing)

    try {
      const submitted = await adapter.placeMarketOrder({
        symbol: SYMBOL,
        ...input,
      })
      return await waitForFilledOrder(adapter, input.clientOrderId, submitted)
    } catch (error) {
      lastError = error
      const details = errorDetails(error)
      const mayAlreadyExist = ['BINGX_101400', 'BINGX_101481'].includes(details.code)
      if (!details.retryable && !mayAlreadyExist) throw error
      await wait(400 * (attempt + 1))
      const reconciled = await adapter.getOrder(SYMBOL, input.clientOrderId)
      if (reconciled) return waitForFilledOrder(adapter, input.clientOrderId, reconciled)
    }
  }
  throw lastError ?? new Error('BingX order submission failed')
}

export function exactLegacyCloseQuantity(expectedQuantity: number, availableQuantity: number) {
  if (!Number.isFinite(expectedQuantity) || expectedQuantity <= 0) return 0
  if (!Number.isFinite(availableQuantity) || availableQuantity <= 0) return 0
  return Math.min(expectedQuantity, availableQuantity)
}

async function persistFilledExecution(input: {
  executionId: string
  requestedQuantity: number
  result: BrokerOrderResult
}) {
  return completeLegacyBingxExecution({
    executionId: input.executionId,
    status: 'FILLED',
    brokerOrderId: input.result.brokerOrderId,
    requestedQuantity: input.requestedQuantity,
    executedQuantity: input.result.filledQuantity,
    averagePrice: input.result.averagePrice,
    rawStatus: input.result.rawStatus,
  })
}

async function recordExecutionFailure(executionId: string, error: unknown) {
  const details = errorDetails(error)
  await failLegacyBingxExecution({
    executionId,
    status: details.retryable ? 'UNKNOWN' : 'FAILED',
    errorCode: details.code,
    errorMessage: details.message,
  })
}

function assertSignalFresh(trade: Trade) {
  const maxAgeSeconds = Number(process.env.BINGX_MAX_SIGNAL_AGE_SECONDS?.trim() || '7200')
  const ageSeconds = Math.floor(Date.now() / 1000) - trade.signal_time
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 60 || ageSeconds > maxAgeSeconds) {
    throw new BrokerPlatformError(
      'BINGX_SIGNAL_STALE',
      `La señal ${trade.id} superó la antigüedad máxima para abrirse.`,
      409,
    )
  }
}

export async function executeBingxOpen(trade: Trade, source: BingxExecutionSource = 'cron') {
  if (!isLegacyBingxEnabled()) return { skipped: true, reason: 'disabled' }
  if (!isSourceAllowed(source)) return { skipped: true, reason: `source_${source}_disabled` }

  assertSignalFresh(trade)
  const adapter = getLegacyAdapter()
  const quantity = configuredQuantity()
  const clientOrderId = legacyOrderClientId('at-open', trade)
  const execution = await beginLegacyBingxExecution({
    tradeId: trade.id,
    action: 'OPEN',
    direction: trade.direction,
    source,
    clientOrderId,
    requestedQuantity: quantity,
  })
  if (execution.status === 'FILLED') {
    return { duplicate: true, execution }
  }

  try {
    const remoteExisting = await adapter.getOrder(SYMBOL, clientOrderId)
    if (remoteExisting) {
      const result = await waitForFilledOrder(adapter, clientOrderId, remoteExisting)
      const stored = await persistFilledExecution({ executionId: execution.id, requestedQuantity: quantity, result })
      return { duplicate: true, execution: stored, result }
    }

    const positions = await adapter.getPositions(SYMBOL)
    const unmanagedPosition = positions.find((position) => position.quantity > 0)
    if (unmanagedPosition) {
      throw new BrokerPlatformError(
        'BINGX_UNMANAGED_POSITION_OPEN',
        `Existe una posición ${unmanagedPosition.direction} sin conciliar en BTC-USDT.`,
        409,
        true,
      )
    }

    await assertOpenRiskLimits(adapter, trade.open_price, quantity)
    await adapter.setLeverage(SYMBOL, trade.direction, configuredLeverage())
    const result = await submitIdempotentBingxMarketOrder(adapter, {
      direction: trade.direction,
      side: trade.direction === 'LONG' ? 'BUY' : 'SELL',
      quantity,
      reduceOnly: false,
      clientOrderId,
    })
    const stored = await persistFilledExecution({ executionId: execution.id, requestedQuantity: quantity, result })

    await logEvent('bingx_order_open', {
      tradeId: trade.id,
      direction: trade.direction,
      symbol: SYMBOL,
      quantity,
      source,
      demo: process.env.BINGX_USE_DEMO !== 'false',
      result,
    })

    return { execution: stored, result }
  } catch (error) {
    await recordExecutionFailure(execution.id, error)
    throw error
  }
}

export async function executeBingxClose(trade: Trade, source: BingxExecutionSource = 'cron') {
  if (!isLegacyBingxEnabled()) return { skipped: true, reason: 'disabled' }
  if (!isSourceAllowed(source)) return { skipped: true, reason: `source_${source}_disabled` }

  const adapter = getLegacyAdapter()
  const openClientOrderId = legacyOrderClientId('at-open', trade)
  let openExecution = await getLegacyBingxExecution(trade.id, 'OPEN')
  if (!openExecution || openExecution.status !== 'FILLED' || Number(openExecution.executed_quantity) <= 0) {
    const remoteOpen = await adapter.getOrder(SYMBOL, openClientOrderId)
    if (remoteOpen?.status === 'FILLED' && remoteOpen.filledQuantity > 0) {
      const pendingOpen = await beginLegacyBingxExecution({
        tradeId: trade.id,
        action: 'OPEN',
        direction: trade.direction,
        source,
        clientOrderId: openClientOrderId,
        requestedQuantity: remoteOpen.filledQuantity,
      })
      openExecution = await persistFilledExecution({
        executionId: pendingOpen.id,
        requestedQuantity: remoteOpen.filledQuantity,
        result: remoteOpen,
      })
    }
  }
  const expectedQuantity = Number(openExecution?.executed_quantity ?? 0)
  if (!openExecution || openExecution.status !== 'FILLED' || expectedQuantity <= 0) {
    await logEvent('bingx_order_close_skip', {
      tradeId: trade.id, direction: trade.direction, symbol: SYMBOL, source,
      reason: 'open_execution_not_confirmed',
    })
    return { skipped: true, reason: 'open_execution_not_confirmed' }
  }

  const clientOrderId = legacyOrderClientId('at-close', trade)
  const execution = await beginLegacyBingxExecution({
    tradeId: trade.id,
    action: 'CLOSE',
    direction: trade.direction,
    source,
    clientOrderId,
    requestedQuantity: expectedQuantity,
  })
  if (execution.status === 'FILLED' || execution.status === 'SKIPPED') {
    return { duplicate: true, execution }
  }

  try {
    const remoteExisting = await adapter.getOrder(SYMBOL, clientOrderId)
    if (remoteExisting) {
      const result = await waitForFilledOrder(adapter, clientOrderId, remoteExisting)
      const stored = await persistFilledExecution({
        executionId: execution.id,
        requestedQuantity: expectedQuantity,
        result,
      })
      return { duplicate: true, execution: stored, result }
    }

    const positions = await adapter.getPositions(SYMBOL)
    const position = positions.find((item) => item.direction === trade.direction)
    const availableQuantity = Number(position?.availableQuantity ?? 0)
    const quantity = exactLegacyCloseQuantity(expectedQuantity, availableQuantity)
    if (quantity <= 0) {
      const skipped = await completeLegacyBingxExecution({
        executionId: execution.id,
        status: 'SKIPPED',
        requestedQuantity: expectedQuantity,
        executedQuantity: 0,
        errorCode: 'BINGX_POSITION_NOT_FOUND',
        errorMessage: 'The expected position was already absent at close time.',
      })
      await logEvent('bingx_order_close_skip', {
        tradeId: trade.id, direction: trade.direction, symbol: SYMBOL, source,
        expectedQuantity, availableQuantity, reason: 'position_not_found',
      })
      return { skipped: true, reason: 'position_not_found', execution: skipped }
    }

    if (Math.abs(quantity - expectedQuantity) > 1e-12) {
      await logEvent('bingx_legacy_quantity_mismatch', {
        tradeId: trade.id, direction: trade.direction, expectedQuantity, availableQuantity,
        closeQuantity: quantity,
      })
    }

    const result = await submitIdempotentBingxMarketOrder(adapter, {
      direction: trade.direction,
      side: trade.direction === 'LONG' ? 'SELL' : 'BUY',
      quantity,
      reduceOnly: true,
      clientOrderId,
    })
    const stored = await persistFilledExecution({ executionId: execution.id, requestedQuantity: quantity, result })

    await logEvent('bingx_order_close', {
      tradeId: trade.id,
      direction: trade.direction,
      symbol: SYMBOL,
      quantity,
      expectedQuantity,
      source,
      demo: process.env.BINGX_USE_DEMO !== 'false',
      result,
    })

    return { execution: stored, result }
  } catch (error) {
    await recordExecutionFailure(execution.id, error)
    throw error
  }
}

export async function safeExecuteBingxOpen(trade: Trade, actions?: string[], source: BingxExecutionSource = 'cron') {
  try {
    const result = await executeBingxOpen(trade, source)
    actions?.push(result && 'skipped' in result ? 'bingx_open_skipped' : 'bingx_open_sent')
    return result
  } catch (err) {
    actions?.push('bingx_open_failed')
    await logEvent('bingx_order_fail', { tradeId: trade.id, action: 'open', error: String(err) })
    console.error('[bingx open]', err)
    return null
  }
}

export async function safeExecuteBingxClose(trade: Trade, actions?: string[], source: BingxExecutionSource = 'cron') {
  try {
    const result = await executeBingxClose(trade, source)
    actions?.push(result && 'skipped' in result ? 'bingx_close_skipped' : 'bingx_close_sent')
    return result
  } catch (err) {
    actions?.push('bingx_close_failed')
    await logEvent('bingx_order_fail', { tradeId: trade.id, action: 'close', error: String(err) })
    console.error('[bingx close]', err)
    return null
  }
}

export async function reconcileLegacyBingxExecutions(actions?: string[]) {
  if (!isLegacyBingxEnabled()) return { skipped: true, reason: 'disabled' }

  const admin = createAdminClient()
  const cutoff = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const { data: closedTrades, error: closedError } = await admin
    .from('algotrend_trades')
    .select('*')
    .eq('status', 'CLOSED')
    .gte('close_time', cutoff)
    .order('close_time', { ascending: true })
    .limit(50)
  if (closedError) throw closedError

  let recoveredCloses = 0
  let closeBlocked = false
  for (const trade of (closedTrades ?? []) as Trade[]) {
    const openExecution = await getLegacyBingxExecution(trade.id, 'OPEN')
    const closeExecution = await getLegacyBingxExecution(trade.id, 'CLOSE')
    if (closeExecution && ['FILLED', 'SKIPPED'].includes(closeExecution.status)) continue
    if (!openExecution || ['FAILED', 'SKIPPED'].includes(openExecution.status)) continue

    const result = await safeExecuteBingxClose(trade, actions, 'cron')
    if (!result) {
      closeBlocked = true
      break
    }
    if (!('skipped' in result)) recoveredCloses += 1
  }

  let recoveredOpen = false
  if (!closeBlocked) {
    const { data: openTrade, error: openError } = await admin
      .from('algotrend_trades')
      .select('*')
      .eq('status', 'OPEN')
      .maybeSingle()
    if (openError) throw openError
    if (openTrade) {
      const openExecution = await getLegacyBingxExecution(openTrade.id, 'OPEN')
      if (!openExecution || !['FILLED', 'SKIPPED'].includes(openExecution.status)) {
        recoveredOpen = Boolean(await safeExecuteBingxOpen(openTrade as Trade, actions, 'cron'))
      }
    }
  }

  return { recoveredCloses, recoveredOpen, closeBlocked }
}
