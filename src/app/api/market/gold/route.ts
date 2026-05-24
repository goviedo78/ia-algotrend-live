import { NextResponse } from 'next/server'

export const revalidate = 20

type CapitalMarket = {
  epic?: string
  instrumentName?: string
  marketStatus?: string
  snapshot?: {
    bid?: number | string
    offer?: number | string
    updateTime?: string
  }
  bid?: number | string
  offer?: number | string
}

function env(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) return value
  }
  return null
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function midpoint(market: CapitalMarket) {
  const bid = toNumber(market.snapshot?.bid ?? market.bid)
  const offer = toNumber(market.snapshot?.offer ?? market.offer)
  if (bid !== null && offer !== null) return (bid + offer) / 2
  return bid ?? offer
}

function pickGoldMarket(markets: CapitalMarket[], preferredEpic: string | null) {
  if (preferredEpic) {
    const byEpic = markets.find((market) => market.epic?.toLowerCase() === preferredEpic.toLowerCase())
    if (byEpic) return byEpic
  }

  return markets.find((market) => {
    const text = `${market.epic ?? ''} ${market.instrumentName ?? ''}`.toLowerCase()
    return text.includes('gold') || text.includes('xau')
  }) ?? markets[0]
}

async function getCapitalGoldPrice() {
  const apiKey = env('CAPITAL_API_KEY', 'CAPITAL_COM_API_KEY')
  const identifier = env('CAPITAL_IDENTIFIER', 'CAPITAL_COM_IDENTIFIER', 'CAPITAL_EMAIL')
  const password = env('CAPITAL_PASSWORD', 'CAPITAL_COM_PASSWORD')
  const preferredEpic = env('CAPITAL_GOLD_EPIC', 'CAPITAL_COM_GOLD_EPIC')

  if (!apiKey || !identifier || !password) return null

  const baseUrl = (env('CAPITAL_BASE_URL', 'CAPITAL_COM_BASE_URL') ?? 'https://api-capital.backend-capital.com/api/v1').replace(/\/$/, '')

  const session = await fetch(`${baseUrl}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CAP-API-KEY': apiKey,
    },
    body: JSON.stringify({
      identifier,
      password,
      encryptedPassword: false,
    }),
    cache: 'no-store',
  })

  if (!session.ok) throw new Error(`capital_session_${session.status}`)

  const cst = session.headers.get('CST')
  const securityToken = session.headers.get('X-SECURITY-TOKEN')
  if (!cst || !securityToken) throw new Error('capital_missing_session_headers')

  const params = preferredEpic
    ? `epics=${encodeURIComponent(preferredEpic)}`
    : 'searchTerm=gold'

  const marketsResponse = await fetch(`${baseUrl}/markets?${params}`, {
    headers: {
      CST: cst,
      'X-SECURITY-TOKEN': securityToken,
    },
    next: { revalidate },
  })

  if (!marketsResponse.ok) throw new Error(`capital_markets_${marketsResponse.status}`)

  const payload = await marketsResponse.json() as { markets?: CapitalMarket[] }
  const market = pickGoldMarket(payload.markets ?? [], preferredEpic)
  const price = market ? midpoint(market) : null

  if (!market || price === null) throw new Error('capital_gold_price_unavailable')

  return {
    price,
    source: 'capital.com',
    epic: market.epic ?? preferredEpic ?? 'GOLD',
    marketStatus: market.marketStatus ?? null,
    updateTime: market.snapshot?.updateTime ?? null,
  }
}

async function getFallbackGoldPrice() {
  const binance = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', {
    next: { revalidate: 20 },
  })

  if (binance.ok) {
    const data = await binance.json() as { price?: string }
    const price = toNumber(data.price)
    if (price !== null) {
      return { price, source: 'paxg-usdt', epic: 'PAXGUSDT', marketStatus: 'fallback', updateTime: null }
    }
  }

  const coinbase = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot', {
    next: { revalidate: 20 },
  })

  if (!coinbase.ok) throw new Error(`fallback_gold_${coinbase.status}`)

  const data = await coinbase.json() as { data?: { amount?: string } }
  const price = toNumber(data.data?.amount)
  if (price === null) throw new Error('fallback_gold_price_unavailable')

  return { price, source: 'paxg-usd', epic: 'PAXG-USD', marketStatus: 'fallback', updateTime: null }
}

export async function GET() {
  try {
    let data = await getCapitalGoldPrice()
    data ??= await getFallbackGoldPrice()

    return NextResponse.json(
      {
        code: 0,
        symbol: 'XAU/USD',
        ...data,
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=20, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('[market/gold]', err instanceof Error ? err.message : err)
    return NextResponse.json({ code: 1, error: 'gold_price_unavailable' }, { status: 502 })
  }
}
