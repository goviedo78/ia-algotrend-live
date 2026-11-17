import type {
  BrokerCode,
  BrokerCredentials,
  BrokerEnvironment,
  TradeDirection,
} from '../domain'

export interface BrokerBalance {
  asset: string
  equity: number
  availableMargin: number
  usedMargin: number
}

export interface BrokerCommissionRates {
  taker: number
  maker: number
}

export interface BrokerPosition {
  symbol: string
  direction: TradeDirection
  quantity: number
  availableQuantity: number
  entryPrice: number
  markPrice: number
  leverage: number
  unrealizedPnl: number
}

export interface InstrumentRules {
  symbol: string
  quantityStep: number
  minimumQuantity: number
  maximumQuantity: number
  minimumNotional: number
  pricePrecision: number
  quantityPrecision: number
  openEnabled: boolean
  closeEnabled: boolean
  maximumLongLeverage: number
  maximumShortLeverage: number
}

export interface PlaceMarketOrderInput {
  symbol: string
  direction: TradeDirection
  side: 'BUY' | 'SELL'
  quantity: number
  notionalUsd?: number
  reduceOnly: boolean
  clientOrderId: string
}

export interface BrokerOrderResult {
  brokerOrderId: string | null
  clientOrderId: string
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED' | 'UNKNOWN'
  filledQuantity: number
  averagePrice: number | null
  realizedPnl?: number
  fee?: number
  feeAsset?: string
  rawStatus: Record<string, unknown>
}

export interface BrokerFillResult {
  brokerFillId: string
  quantity: number
  price: number
  notionalUsd?: number
  fee: number
  feeAsset: string
  realizedPnl: number
  filledAt: string
}

export type ProtectionKind = 'STOP_LOSS' | 'TAKE_PROFIT'

export interface PlaceTriggerOrderInput {
  symbol: string
  // Dirección de la POSICIÓN protegida; la orden va en el sentido que la reduce.
  direction: TradeDirection
  kind: ProtectionKind
  triggerPrice: number
  quantity: number
}

export interface BrokerTriggerOrder {
  brokerOrderId: string
  kind: ProtectionKind
  direction: TradeDirection | null
  triggerPrice: number
  quantity: number
}

export interface ValidationResult {
  accountReference: string | null
  canRead: boolean
  canTradePerpetuals: boolean | null
  balance: BrokerBalance | null
}

export interface BrokerAdapter {
  readonly broker: BrokerCode
  validateCredentials(): Promise<ValidationResult>
  getBalance(): Promise<BrokerBalance>
  getCommissionRates(): Promise<BrokerCommissionRates>
  getPositions(symbol?: string): Promise<BrokerPosition[]>
  getInstrumentRules(symbol: string): Promise<InstrumentRules>
  getLastPrice(symbol: string): Promise<number>
  setLeverage(symbol: string, direction: TradeDirection, leverage: number): Promise<void>
  placeMarketOrder(input: PlaceMarketOrderInput): Promise<BrokerOrderResult>
  getOrder(symbol: string, clientOrderId: string): Promise<BrokerOrderResult | null>
  getOrderFills(symbol: string, brokerOrderId: string, since: Date, clientOrderId?: string): Promise<BrokerFillResult[]>
  // Órdenes condicionales de protección (stop / take profit). Opcionales: un broker que no
  // las implemente sigue operando como antes, sólo con cierres a mercado.
  placeTriggerOrder?(input: PlaceTriggerOrderInput): Promise<BrokerOrderResult>
  listOpenTriggerOrders?(symbol: string): Promise<BrokerTriggerOrder[]>
  getOrderById?(symbol: string, brokerOrderId: string): Promise<BrokerOrderResult | null>
  cancelOrderById?(symbol: string, brokerOrderId: string): Promise<void>
}

export interface BrokerAdapterFactoryInput {
  credentials: BrokerCredentials
  environment: BrokerEnvironment
  fetchImpl?: typeof fetch
  now?: () => number
}
