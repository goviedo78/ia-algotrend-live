import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Event Logging ──────────────────────────────────────────────────

export async function logEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from('algotrend_events').insert({ event_type: eventType, metadata })
  } catch (err) {
    console.error('[analytics:logEvent]', err)
  }
}

// ── Pageview Logging ───────────────────────────────────────────────

export async function logPageview(pv: {
  path: string
  referrer?: string
  country?: string
  device?: string
  visitorId?: string
}) {
  try {
    await supabase.from('algotrend_pageviews').insert({
      path: pv.path,
      referrer: pv.referrer || null,
      country: pv.country || null,
      device: pv.device || null,
      visitor_id: pv.visitorId || null,
    })
  } catch (err) {
    console.error('[analytics:logPageview]', err)
  }
}

// ── Stats Queries ──────────────────────────────────────────────────

export async function getPageviewStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  // Total pageviews for each period
  const [todayRes, weekRes, monthRes, allRes] = await Promise.all([
    supabase.from('algotrend_pageviews').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('algotrend_pageviews').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('algotrend_pageviews').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('algotrend_pageviews').select('id', { count: 'exact', head: true }),
  ])

  // Last 30 days of pageviews for the daily chart
  const { data: recentPvs } = await supabase
    .from('algotrend_pageviews')
    .select('created_at, visitor_id, country, device, referrer')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })

  const pvs = recentPvs ?? []

  // Group by day
  const dailyMap: Record<string, { views: number; uniques: Set<string> }> = {}
  const countryMap: Record<string, number> = {}
  const deviceMap: Record<string, number> = {}
  const referrerMap: Record<string, number> = {}
  const uniqueVisitors = new Set<string>()
  const hourMap: Record<number, number> = {}

  for (const pv of pvs) {
    const day = pv.created_at.substring(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { views: 0, uniques: new Set() }
    dailyMap[day].views++
    if (pv.visitor_id) {
      dailyMap[day].uniques.add(pv.visitor_id)
      uniqueVisitors.add(pv.visitor_id)
    }

    if (pv.country) countryMap[pv.country] = (countryMap[pv.country] || 0) + 1
    if (pv.device) deviceMap[pv.device] = (deviceMap[pv.device] || 0) + 1
    if (pv.referrer) {
      const ref = cleanReferrer(pv.referrer)
      referrerMap[ref] = (referrerMap[ref] || 0) + 1
    }

    const hour = new Date(pv.created_at).getUTCHours()
    hourMap[hour] = (hourMap[hour] || 0) + 1
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, views: d.views, uniques: d.uniques.size }))

  const countries = Object.entries(countryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([country, count]) => ({ country, count }))

  const devices = Object.entries(deviceMap).map(([device, count]) => ({ device, count }))

  const referrers = Object.entries(referrerMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }))

  const peakHours = Object.entries(hourMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))

  return {
    today: todayRes.count ?? 0,
    week: weekRes.count ?? 0,
    month: monthRes.count ?? 0,
    total: allRes.count ?? 0,
    uniqueVisitors30d: uniqueVisitors.size,
    daily,
    countries,
    devices,
    referrers,
    peakHours,
  }
}

export async function getNotificationStats() {
  const { data: events } = await supabase
    .from('algotrend_events')
    .select('event_type, metadata, created_at')
    .in('event_type', ['push_sent', 'push_fail', 'email_sent', 'email_fail'])
    .order('created_at', { ascending: false })
    .limit(100)

  const evts = events ?? []

  let totalPushSent = 0
  let totalPushDevices = 0
  let totalPushFail = 0
  let totalEmailSent = 0
  let totalEmailFail = 0

  const log: Array<{
    type: string
    title: string
    devices: number
    time: string
  }> = []

  for (const e of evts) {
    const meta = (e.metadata ?? {}) as Record<string, unknown>
    if (e.event_type === 'push_sent') {
      totalPushSent++
      const sent = (meta.sent as number) || 0
      totalPushDevices += sent
      log.push({
        type: 'push',
        title: (meta.title as string) || 'Push notification',
        devices: sent,
        time: e.created_at,
      })
    } else if (e.event_type === 'push_fail') {
      totalPushFail++
    } else if (e.event_type === 'email_sent') {
      totalEmailSent++
      log.push({
        type: 'email',
        title: (meta.subject as string) || 'Email',
        devices: 1,
        time: e.created_at,
      })
    } else if (e.event_type === 'email_fail') {
      totalEmailFail++
    }
  }

  return {
    pushSent: totalPushSent,
    pushDevicesReached: totalPushDevices,
    pushFailed: totalPushFail,
    emailSent: totalEmailSent,
    emailFailed: totalEmailFail,
    log: log.slice(0, 50),
  }
}

export async function getDeviceStats() {
  const { data, count } = await supabase
    .from('push_subscriptions')
    .select('endpoint, created_at', { count: 'exact' })
    .eq('tenant_id', 'algotrend')

  const devices = (data ?? []).map((d) => {
    const isApple = d.endpoint.includes('apple')
    const isFirefox = d.endpoint.includes('mozilla') || d.endpoint.includes('firefox')
    const platform = isApple ? 'Apple (Safari)' : isFirefox ? 'Firefox' : 'Chrome'
    return { endpoint: d.endpoint.substring(0, 60) + '…', platform, registeredAt: d.created_at }
  })

  return { total: count ?? 0, devices }
}

export async function getSponsorStats() {
  const { data: events } = await supabase
    .from('algotrend_events')
    .select('event_type, created_at')
    .in('event_type', ['sponsor_impression', 'sponsor_click'])

  const evts = events ?? []
  const impressions = evts.filter((e) => e.event_type === 'sponsor_impression').length
  const clicks = evts.filter((e) => e.event_type === 'sponsor_click').length
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

  return { impressions, clicks, ctr: +ctr.toFixed(2) }
}

export async function getTradePerformanceStats() {
  const { data } = await supabase
    .from('algotrend_trades')
    .select('*')
    .eq('status', 'CLOSED')
    .order('open_time', { ascending: true })

  const trades = data ?? []
  const total = trades.length
  const wins = trades.filter((t) => (t.pnl_usd ?? 0) > 0).length
  const losses = total - wins
  const winRate = total > 0 ? (wins / total) * 100 : 0

  // Equity curve
  let balance = 10000
  let peak = balance
  let maxDrawdown = 0
  let streak = 0
  let bestStreak = 0
  let currentStreak = 0

  const equityCurve: Array<{ time: number; balance: number }> = [{ time: 0, balance }]
  const monthlyPnl: Record<string, number> = {}

  for (const t of trades) {
    const pct = t.pnl_pct ?? 0
    balance *= 1 + pct / 100

    if (balance > peak) peak = balance
    const dd = ((peak - balance) / peak) * 100
    if (dd > maxDrawdown) maxDrawdown = dd

    const isWin = (t.pnl_usd ?? 0) > 0
    if (isWin) {
      currentStreak++
      if (currentStreak > bestStreak) bestStreak = currentStreak
    } else {
      currentStreak = 0
    }

    equityCurve.push({ time: t.open_time, balance: +balance.toFixed(2) })

    // Monthly PnL
    const d = new Date(t.open_time * 1000)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyPnl[monthKey] = (monthlyPnl[monthKey] || 0) + (t.pnl_usd ?? 0)
  }

  const totalPnl = balance - 10000
  const totalPnlPct = (balance / 10000 - 1) * 100

  // Simple Sharpe approximation (annualized)
  const returns = trades.map((t) => t.pnl_pct ?? 0)
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 1
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0

  const monthly = Object.entries(monthlyPnl)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: +pnl.toFixed(2) }))

  return {
    total,
    wins,
    losses,
    winRate: +winRate.toFixed(1),
    totalPnl: +totalPnl.toFixed(2),
    totalPnlPct: +totalPnlPct.toFixed(2),
    balance: +balance.toFixed(2),
    maxDrawdown: +maxDrawdown.toFixed(2),
    bestStreak,
    currentStreak,
    sharpe: +sharpe.toFixed(2),
    equityCurve,
    monthly,
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function cleanReferrer(ref: string): string {
  try {
    const url = new URL(ref)
    return url.hostname.replace('www.', '')
  } catch {
    return ref || 'direct'
  }
}
