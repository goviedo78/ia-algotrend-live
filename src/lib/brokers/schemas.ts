import { z } from 'zod'
import { DEFAULT_BROKER_ALLOCATION_PCT } from './risk-profiles'
import { BROKER_STRATEGY_CODES } from './strategies'

const safeLabel = z.string().trim().min(1).max(80)
const apiSecret = z.string().trim().min(16).max(512)
const symbol = z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/).transform((value) => value.toUpperCase())

export const connectionCreateSchema = z.object({
  broker: z.enum(['BINGX', 'BINANCE']),
  environment: z.enum(['DEMO', 'LIVE']),
  strategyCode: z.enum(BROKER_STRATEGY_CODES),
  label: safeLabel,
  capitalUsd: z.number().min(100).max(10_000_000),
  riskProfile: z.enum(['ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE']),
  sizingMode: z.enum(['FIXED_NOTIONAL', 'EQUITY_PERCENT']).default('FIXED_NOTIONAL'),
  allocationPct: z.number().min(1).max(100).default(DEFAULT_BROKER_ALLOCATION_PCT),
  apiKey: apiSecret,
  secretKey: apiSecret,
  permissions: z.object({
    read: z.literal(true),
    perpetualTrading: z.literal(true),
    spot: z.literal(false),
    withdrawal: z.literal(false),
    universalTransfer: z.literal(false),
    subaccounts: z.literal(false),
    p2p: z.literal(false),
  }).strict(),
  ipRestrictionConfirmed: z.boolean().default(false),
}).strict()

export const rotateCredentialsSchema = z.object({
  apiKey: apiSecret,
  secretKey: apiSecret,
}).strict()

export const riskChangeSchema = z.object({
  capitalUsd: z.number().min(100).max(10_000_000),
  riskProfile: z.enum(['ULTRA_CONSERVATIVE', 'CONSERVATIVE', 'MODERATE']),
  sizingMode: z.enum(['FIXED_NOTIONAL', 'EQUITY_PERCENT']),
  allocationPct: z.number().min(1).max(100),
  // Sin techo de producto: el titular elige su lotaje y su pérdida diaria. El máximo sólo
  // acompaña al del capital para que ningún valor expresable en capital quede inalcanzable.
  fixedNotionalUsd: z.number().positive().max(10_000_000).optional(),
  dailyLossLimitUsd: z.number().positive().max(10_000_000).optional(),
}).strict()

export const connectionActionSchema = z.object({
  action: z.enum(['SUSPEND', 'REVOKE']),
}).strict()

export const membershipReviewSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']),
  note: z.string().trim().max(1000).optional(),
}).strict()

export const adminConnectionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('APPROVE'),
    risk: z.object({
      sizingMode: z.enum(['FIXED_NOTIONAL', 'EQUITY_PERCENT']),
      exposurePerOrderPct: z.number().min(1).max(100),
      fixedNotionalUsd: z.number().positive().max(1_000_000),
      maxNotionalPerOrderUsd: z.number().positive().max(1_000_000),
      maxTotalExposureUsd: z.number().positive().max(10_000_000),
      maxLeverage: z.number().min(1).max(20),
      maxOpenPositions: z.number().int().min(1).max(20),
      maxOrdersPerMinute: z.number().int().min(1).max(60),
      dailyLossLimitUsd: z.number().positive().max(1_000_000),
      minAvailableMarginUsd: z.number().min(0).max(1_000_000),
    }).strict(),
  }).strict(),
  z.object({ action: z.literal('PREPARE_EDIT') }).strict(),
  z.object({ action: z.literal('UPDATE_LABEL'), label: safeLabel }).strict(),
  z.object({ action: z.literal('REJECT'), note: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ action: z.literal('SUSPEND'), note: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal('RESUME'), note: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal('REVOKE'), note: z.string().trim().max(1000).optional() }).strict(),
  z.object({ action: z.literal('CONFIRM_MANUAL_RESOLUTION'), note: z.string().trim().min(1).max(1000) }).strict(),
])

export const brokerSignalSchema = z.object({
  externalSignalId: z.string().trim().min(1).max(120),
  strategyCode: z.string().trim().min(1).max(80),
  symbol,
  timeframe: z.string().trim().regex(/^[A-Za-z0-9]{1,20}$/),
  action: z.enum(['OPEN', 'CLOSE']),
  direction: z.enum(['LONG', 'SHORT']),
  signalTime: z.iso.datetime({ offset: true }),
  price: z.number().positive().optional(),
}).strict()

export type BrokerSignalInput = z.infer<typeof brokerSignalSchema>
