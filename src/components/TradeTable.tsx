'use client'

import type { Trade } from '@/lib/db'

interface TradeTableProps {
  trades: Trade[]
  openTrade: Trade | null
  currentPrice: number | null
}

function fmt(n: number | null | undefined) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('es-MX', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}

export default function TradeTable({ trades: tradesProp, openTrade, currentPrice }: TradeTableProps) {
  const trades = Array.isArray(tradesProp) ? tradesProp : []
  const livePnl = openTrade && currentPrice
    ? (() => {
        const mult = openTrade.direction === 'LONG' ? 1 : -1
        const pct = (currentPrice - openTrade.open_price) / openTrade.open_price * mult * 100
        const usd = (currentPrice - openTrade.open_price) * mult
        return { pct, usd }
      })()
    : null

  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1F2937] px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <p className="label-eyebrow">Historial de operaciones</p>
          <p className="mt-1 text-[10px] sm:text-xs text-[#9CA3AF]">Últimas operaciones del backtest y posición abierta en vivo.</p>
        </div>
        <span className="badge text-[10px] sm:text-xs">{closedTrades.length} cerradas</span>
      </div>

      {openTrade && (
        <div
          className={`flex items-center justify-between border-b border-[#1F2937] px-4 py-2.5 sm:px-5 sm:py-3 ${
            openTrade.direction === 'LONG' ? 'bg-[#0f2a1f]' : 'bg-[#2a1218]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`badge ${openTrade.direction === 'LONG' ? 'badge-live' : 'badge-danger'}`}>
              {openTrade.direction === 'LONG' ? 'Largo abierto' : 'Corto abierto'}
            </span>
            <span className="text-xs font-mono text-[#9CA3AF]">@ ${fmt(openTrade.open_price)}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#9CA3AF]">SL ${fmt(openTrade.stop_loss)} · TP ${fmt(openTrade.take_profit)}</span>
            {livePnl && (
              <span className={`ml-3 text-xs font-mono font-bold ${livePnl.usd >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {livePnl.usd >= 0 ? '+' : ''}${fmt(livePnl.usd)} ({livePnl.pct.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1F2937] text-[#9CA3AF]">
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Dirección</th>
              <th className="px-3 py-3 text-left">Entrada</th>
              <th className="px-3 py-3 text-left">Salida</th>
              <th className="px-3 py-3 text-right">Precio Entrada</th>
              <th className="px-3 py-3 text-right">Precio Salida</th>
              <th className="px-3 py-3 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {closedTrades.slice(0, 80).map((trade, idx) => {
              const win = (trade.pnl_usd ?? 0) >= 0
              const directionLabel = trade.direction === 'LONG' ? 'Largo' : 'Corto'
              const exitLabel = trade.direction === 'LONG' ? 'Salida Largo' : 'Salida Corto'
              const sequence = closedTrades.length - idx
              return (
                <tr key={trade.id} className="border-b border-[#1F2937] transition-colors hover:bg-[#0F172A]">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[#9CA3AF]">{sequence}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`badge ${trade.direction === 'LONG' ? 'badge-live' : 'badge-danger'}`}>
                      {trade.direction === 'LONG' ? 'Largo' : 'Corto'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[#E5E7EB]">{fmtTime(trade.open_time)}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{directionLabel}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[#E5E7EB]">{trade.close_time ? fmtTime(trade.close_time) : '—'}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{trade.close_time ? exitLabel : '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#E5E7EB]">${fmt(trade.open_price)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#E5E7EB]">{trade.close_price ? `$${fmt(trade.close_price)}` : '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${win ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    <div>{win ? '+' : ''}${fmt(trade.pnl_usd ?? 0)}</div>
                    <div className={win ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                      {(trade.pnl_pct ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </div>
                  </td>
                </tr>
              )
            })}
            {closedTrades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#6B7280]">
                  Esperando la primera operación cerrada...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
