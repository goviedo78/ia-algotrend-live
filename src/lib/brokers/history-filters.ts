import { enrichBrokerTradeCycles, summarizeBrokerOrderHistory, effectiveTime } from './order-history-metrics'
import type { BrokerOrderHistoryResponse, BrokerOrderHistoryItem } from './order-history-types'

export type HistorySelection = { connectionId?: string; start?: string; end?: string; timeZone: string }
export type HistoryGrouping = 'day' | 'week' | 'month'

const dateFormats = new Map<string, Intl.DateTimeFormat>()

export function calendarDate(value: string | Date, timeZone: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  let formatter = dateFormats.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    dateFormats.set(timeZone, formatter)
  }
  const parts = formatter.formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function validDate(value?: string) {
  if (!value) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDate(`${value}T12:00:00Z`, 'UTC') === value
}
export function validHistoryRange(start?: string, end?: string) {
  return validDate(start) && validDate(end) && !(start && end && start > end)
}
export function historyDateRange(period: 'all' | 'week' | 'month', now: Date, timeZone: string) {
  if (period === 'all') return { start: '', end: '' }
  const end = calendarDate(now, timeZone)
  const startDate = new Date(`${end}T12:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() - (period === 'week' ? 6 : 29))
  return { start: calendarDate(startDate, 'UTC'), end }
}

/** Enrich the entire lifetime BEFORE selecting execution dates. Old entry costs
 * remain available to a close even when the opening falls outside the range. */
export function selectBrokerHistory(history: BrokerOrderHistoryResponse, filters: HistorySelection): BrokerOrderHistoryResponse {
  const matchesConnection = (item: { connectionId: string }) => !filters.connectionId || item.connectionId === filters.connectionId
  const inRange = (time: string) => {
    if (!validHistoryRange(filters.start, filters.end)) return false
    const day = calendarDate(time, filters.timeZone)
    return !!day && (!filters.start || day >= filters.start) && (!filters.end || day <= filters.end)
  }
  const settlements = history.externalSettlements.filter(matchesConnection)
  const enriched = enrichBrokerTradeCycles(history.orders.filter(matchesConnection), settlements)
  const orders = enriched.filter(order => inRange(effectiveTime(order)))
    .sort((a, b) => Date.parse(effectiveTime(b)) - Date.parse(effectiveTime(a)) || a.id.localeCompare(b.id))
  return {
    orders,
    ...summarizeBrokerOrderHistory(orders),
    // Current positions are never reconstructed from a historical slice.
    openPositions: history.openPositions.filter(matchesConnection),
    externalSettlements: settlements.filter(item => inRange(item.settledAt)),
    missedOpportunities: (history.missedOpportunities ?? []).filter(item => matchesConnection(item) && inRange(item.rejectedAt)),
  }
}

export function brokerHistoryBars(orders: BrokerOrderHistoryItem[], grouping: HistoryGrouping, timeZone: string) {
  const buckets = new Map<string, { date: string; netPnlUsd: number; count: number; entryNotionalUsd: number; netReturnPct: number | null; volumeUsd: number }>()
  for (const order of orders) {
    let day = calendarDate(effectiveTime(order), timeZone)
    if (!day) continue
    if (grouping === 'month') day = day.slice(0, 7) + '-01'
    if (grouping === 'week') {
      const d = new Date(`${day}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7)
      day = calendarDate(d, 'UTC')
    }
    const bucket = buckets.get(day) ?? { date: day, netPnlUsd: 0, count: 0, entryNotionalUsd: 0, netReturnPct: null, volumeUsd: 0 }
    bucket.volumeUsd += order.notionalUsd
    if (order.action === 'CLOSE' && order.tradeNetPnlUsd != null && order.entryNotionalUsd != null && order.netReturnPct != null) {
      bucket.netPnlUsd += order.tradeNetPnlUsd
      bucket.entryNotionalUsd += order.entryNotionalUsd
      bucket.count++
      bucket.netReturnPct = bucket.entryNotionalUsd > 0 ? bucket.netPnlUsd / bucket.entryNotionalUsd * 100 : null
    }
    buckets.set(day, bucket)
  }
  // Keep quiet periods on the time axis rather than visually compressing them.
  const keys = [...buckets.keys()].sort()
  if (keys.length) {
    const cursor = new Date(`${keys[0]}T12:00:00Z`)
    const last = keys.at(-1)!
    while (calendarDate(cursor, 'UTC') <= last) {
      const day = calendarDate(cursor, 'UTC')
      if (!buckets.has(day)) buckets.set(day, { date: day, netPnlUsd: 0, count: 0, entryNotionalUsd: 0, netReturnPct: null, volumeUsd: 0 })
      if (grouping === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      else cursor.setUTCDate(cursor.getUTCDate() + (grouping === 'week' ? 7 : 1))
    }
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}
