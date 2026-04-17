'use client'

import type { Trade } from '@/lib/db'

interface TradeTableProps {
  trades: Trade[]
  openTrade: Trade | null
  currentPrice: number | null
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('es-MX', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TradeTable({ trades, openTrade, currentPrice }: TradeTableProps) {
  const livePnl = openTrade && currentPrice
    ? (() => {
        const mult = openTrade.direction === 'LONG' ? 1 : -1
        const pct  = (currentPrice - openTrade.open_price) / openTrade.open_price * mult * 100
        return { pct, usd: 10000 * pct / 100 }
      })()
    : null

  return (
    <div className="bg-[#080812] border border-[#1a1a30] rounded-lg overflow-hidden">
      <div className="bg-[#04040e] px-4 py-2 border-b border-[#14142a] flex items-center justify-between">
        <span className="text-[#00e5ff] text-xs font-bold tracking-widest">HISTORIAL DE OPERACIONES</span>
        <span className="text-[#4a5a6a] text-xs">{trades.length} trades</span>
      </div>

      {/* Open trade banner */}
      {openTrade && (
        <div className={`px-4 py-2 flex items-center justify-between border-b border-[#14142a] ${openTrade.direction === 'LONG' ? 'bg-[#00e676]/5' : 'bg-[#ff1744]/5'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${openTrade.direction === 'LONG' ? 'bg-[#00e676]/20 text-[#00e676]' : 'bg-[#ff1744]/20 text-[#ff1744]'}`}>
              {openTrade.direction} ABIERTO
            </span>
            <span className="text-gray-400 text-xs font-mono">@ ${fmt(openTrade.open_price)}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#4a5a6a]">SL ${fmt(openTrade.stop_loss)}  TP ${fmt(openTrade.take_profit)}</span>
            {livePnl && (
              <span className={`ml-3 text-xs font-mono font-bold ${livePnl.usd >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
                {livePnl.usd >= 0 ? '+' : ''}${fmt(livePnl.usd)} ({livePnl.pct.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#4a5a6a] border-b border-[#14142a]">
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-left">Apertura</th>
              <th className="px-3 py-2 text-right">Entrada</th>
              <th className="px-3 py-2 text-right">Cierre</th>
              <th className="px-3 py-2 text-right">Razón</th>
              <th className="px-3 py-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trades.filter(t => t.status === 'CLOSED').slice(0, 50).map(trade => {
              const win = (trade.pnl_usd ?? 0) >= 0
              return (
                <tr key={trade.id} className="border-b border-[#0c0c1a] hover:bg-[#0c0c1a] transition-colors">
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.direction === 'LONG' ? 'bg-[#00e676]/15 text-[#00e676]' : 'bg-[#ff1744]/15 text-[#ff1744]'}`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[#4a5a6a] font-mono">{fmtTime(trade.open_time)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-300">${fmt(trade.open_price)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-gray-300">{trade.close_price ? `$${fmt(trade.close_price)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      trade.close_reason === 'TP' ? 'bg-[#00e676]/15 text-[#00e676]' :
                      trade.close_reason === 'SL' ? 'bg-[#ff1744]/15 text-[#ff1744]' :
                      'bg-yellow-400/15 text-yellow-400'
                    }`}>
                      {trade.close_reason ?? '—'}
                    </span>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono font-semibold ${win ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
                    {win ? '+' : ''}${fmt(trade.pnl_usd ?? 0)}
                  </td>
                </tr>
              )
            })}
            {trades.filter(t => t.status === 'CLOSED').length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#4a5a6a]">
                  El engine está analizando — las operaciones aparecerán aquí
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
