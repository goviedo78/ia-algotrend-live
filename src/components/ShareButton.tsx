'use client'

import { useState, useCallback } from 'react'

interface ShareButtonProps {
  price: number | null
  winRate: number
  returnPct: number
  balance: number
  totalTrades: number
}

function buildShareText({
  price,
  winRate,
  returnPct,
  balance,
  totalTrades,
}: ShareButtonProps): string {
  const priceStr = price
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'BTC'
  const sign = returnPct >= 0 ? '+' : ''

  return [
    `🔥 IA AlgoTrend · BTC Live Desk`,
    `📊 Win Rate: ${winRate.toFixed(1)}% · Rendimiento: ${sign}${returnPct.toFixed(2)}%`,
    `💎 Balance: $${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} · ${totalTrades} operaciones`,
    `💰 Precio BTC: ${priceStr}`,
    ``,
    `🔗 https://gonovi.app`,
  ].join('\n')
}

export default function ShareButton(props: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const text = buildShareText(props)

    // Track share event
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'share', method: typeof navigator.share === 'function' ? 'native' : 'clipboard' }),
    }).catch(() => {})

    // Try native share API first
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'IA AlgoTrend · Live Trading Desk',
          text,
          url: 'https://gonovi.app',
        })
        return
      } catch (err) {
        // User cancelled or API failed — fall through to clipboard
        if ((err as Error)?.name === 'AbortError') return
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Last resort: prompt
      window.prompt('Copia este texto para compartir:', text)
    }
  }, [props])

  return (
    <button
      onClick={handleShare}
      className="glass-btn"
      title="Compartir AlgoTrend"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="hidden sm:inline">Copiado</span>
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span className="hidden sm:inline">Compartir</span>
        </>
      )}
    </button>
  )
}
