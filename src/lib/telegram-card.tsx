import React from 'react'
import { ImageResponse } from 'next/og'
import { closeReasonText, elapsedPeriod, entryPresentation, entryRiskLines, getPerformanceWindow, localTradeDate, operationDuration, outcomePresentation, tradePercent, tradePrice, type SignalMark, type TradeCardData } from './telegram-performance'

// GONOVI v2: exact brand tokens and their accessible semantic ramps.
const ink = '#1C223A'
const bone = '#E5D4B6'
const muted = '#6B7385'
const bronze = '#9A7E54'
const gold = '#C9A87A'
const green = '#1A3024'
const red = '#D43D10'
const neutral = '#ECEDEF'
const paper = '#F8F5EF'
const rule = '#D9DBE0'
const shadow = '0 12px 28px rgba(28, 34, 58, 0.09)'

// Draw the same cues locally: PNG generation never fetches emoji assets.
function SignalIcon({ mark, size }: { mark: SignalMark; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24">
    {mark === 'buy' && <circle cx="12" cy="12" r="10" fill="#4FBC72" />}
    {mark === 'sell' && <circle cx="12" cy="12" r="10" fill="#DE3E3E" />}
    {mark === 'win' && <g><rect x="1" y="1" width="22" height="22" rx="5" fill="#328A52" /><path d="M6 12l4 4 8-9" fill="none" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>}
    {mark === 'loss' && <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="#DE3E3E" strokeWidth="4" strokeLinecap="round" />}
    {mark === 'neutral' && <circle cx="12" cy="12" r="9" fill="#ECEDEF" stroke="#6B7385" strokeWidth="2" />}
  </svg>
}

export function tradeCardElement(data: TradeCardData) {
  if (data.event === 'OPEN') {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: 44, background: neutral, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: '40px 56px', background: paper, color: ink, border: `1px solid ${rule}`, borderRadius: 28, boxShadow: shadow }}>
        <div style={{ display: 'flex', fontSize: 29, letterSpacing: 4, color: muted }}>ENTRADA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 112, fontWeight: 700, letterSpacing: -4, marginTop: 12, color: ink, alignSelf: 'flex-start', borderBottom: `4px solid ${data.trade.direction === 'LONG' ? '#4FBC72' : '#F44E1C'}`, paddingBottom: 10 }}><SignalIcon mark={entryPresentation(data.trade.direction).mark} size={68} />{entryPresentation(data.trade.direction).label}</div>
        <div style={{ display: 'flex', fontSize: 38, marginTop: 20 }}>BTC · 1H</div>
        <div style={{ display: 'flex', fontSize: 32, color: ink, marginTop: 14 }}>{`Entrada: ${tradePrice(data.trade.open_price)}`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24, paddingTop: 22, borderTop: `1px solid ${rule}`, fontSize: 29 }}>
          {entryRiskLines(data.trade, data.probabilityPct).map(line => <div key={line} style={{ display: 'flex' }}>{line}</div>)}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: muted, marginTop: 26 }}>{`${localTradeDate(data.trade.open_time)} · CDMX`}</div>
      </div>
      </div>
    )
  }

  const stats = getPerformanceWindow(data.recent, data.trade)
  const resultColor = stats.compoundedPct === null ? bone : stats.compoundedPct < 0 ? '#F44E1C' : '#4FBC72'
  const outcome = data.event === 'CLOSE' ? outcomePresentation(data.trade.pnl_pct) : null
  const closeColor = outcome?.mark === 'loss' ? red : outcome?.mark === 'win' ? green : muted
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 32, background: neutral, fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 36, background: paper, color: ink, border: `1px solid ${rule}`, borderRadius: 28, boxShadow: shadow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 22, borderBottom: `1px solid ${rule}` }}>
        <div style={{ display: 'flex', fontSize: 31, letterSpacing: 7, fontWeight: 700 }}>GONOVI</div>
        <div style={{ display: 'flex', fontSize: 23, color: bronze, letterSpacing: 2 }}>INDICADOR · DEMO</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 24 }}>
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, letterSpacing: -2 }}>AlgoTrend</div>
        <div style={{ display: 'flex', fontSize: 30, color: muted }}>BTC · 1H</div>
      </div>
      {data.event === 'CLOSE' ? (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '23px 28px', marginTop: 24, background: '#F0E8DA', border: '1px solid #DFD4C1', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 34, color: bronze, letterSpacing: 3 }}>CIERRE</div>
            <div style={{ display: 'flex', fontSize: 23, color: muted }}>{`${localTradeDate(data.trade.close_time ?? data.trade.open_time)} · CDMX`}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, color: muted }}><SignalIcon mark={outcomePresentation(data.trade.pnl_pct).mark} size={25} />{outcomePresentation(data.trade.pnl_pct).label}</div>
              <div style={{ display: 'flex', fontSize: 86, letterSpacing: -3, color: closeColor }}>{tradePercent(data.trade.pnl_pct)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', fontSize: 22, color: muted }}>DURACIÓN DE LA OPERACIÓN</div>
              <div style={{ display: 'flex', fontSize: 39 }}>{operationDuration(data.trade)}</div>
              <div style={{ display: 'flex', fontSize: 23, color: muted }}>{`Entrada: ${tradePrice(data.trade.open_price)}`}</div>
              <div style={{ display: 'flex', fontSize: 23, color: muted }}>{`Cierre: ${tradePrice(data.trade.close_price)}`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: muted, marginTop: 14 }}>{`Motivo: ${closeReasonText(data.trade, data.trailingStopActive)}`}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '23px 28px', marginTop: 24, background: '#F0E8DA', border: '1px solid #DFD4C1', borderRadius: 16 }}>
          <div style={{ display: 'flex', fontSize: 33, color: bronze }}>RESUMEN DE OPERACIONES</div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 23, color: muted }}>Historial del indicador · No es una señal nueva</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 29, paddingBottom: 13, fontSize: 23, color: bronze, letterSpacing: 1 }}>
        <span>{`ÚLTIMAS ${stats.trades.length} OPERACIONES CERRADAS`}</span><span>PNL %</span>
      </div>
      {stats.trades.map((trade) => (
        <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${rule}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 17, fontSize: 28 }}>
              <span style={{ color: muted }}>{`#${trade.id}`}</span><span style={{ display: 'flex', alignItems: 'center', gap: 8, color: trade.direction === 'LONG' ? green : red }}><SignalIcon mark={entryPresentation(trade.direction).mark} size={20} />{entryPresentation(trade.direction).label}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: muted }}>{`${localTradeDate(trade.open_time)} → ${trade.close_time !== null ? localTradeDate(trade.close_time) : '—'}`}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 36, color: trade.pnl_pct === null ? muted : trade.pnl_pct < 0 ? red : green }}><SignalIcon mark={outcomePresentation(trade.pnl_pct).mark} size={27} />{tradePercent(trade.pnl_pct)}</div>
        </div>
      ))}
      {!stats.trades.length && <div style={{ display: 'flex', fontSize: 29, color: muted, padding: '30px 0' }}>{data.recent === null ? 'Historial temporalmente no disponible' : 'Todavía no hay operaciones cerradas'}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 25, padding: '22px 24px 18px', background: ink, color: bone, borderTop: `3px solid ${gold}`, borderRadius: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignSelf: 'flex-start', fontSize: 24, letterSpacing: 2, color: gold, borderBottom: `2px solid ${gold}`, paddingBottom: 7 }}>PNL ACUMULADO · COMPUESTO TEÓRICO</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 26, marginTop: 4 }}>
          <div style={{ display: 'flex', fontSize: 84, letterSpacing: -5, color: resultColor }}>{tradePercent(stats.compoundedPct)}</div>
          <div style={{ display: 'flex', fontSize: 29 }}>{stats.elapsedSeconds !== null ? `en ${elapsedPeriod(stats.elapsedSeconds)}` : 'Período no disponible'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(229, 212, 182, 0.18)', borderBottom: '1px solid rgba(229, 212, 182, 0.18)', padding: '13px 0' }}>
        <div style={{ display: 'flex', fontSize: 28 }}>Tasa de aciertos</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 43, color: gold }}>{stats.winRate === null ? '—' : `${Math.round(stats.winRate)}%`}</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#A8AABA' }}>{stats.wins ?? '—'} de {stats.trades.length} ganadoras</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18, gap: 6, fontSize: 22, color: '#A8AABA' }}>
        <div style={{ display: 'flex' }}>{stats.startTime !== null ? `DESDE · ${localTradeDate(stats.startTime)}` : 'DESDE · Sin datos suficientes'}</div>
        <div style={{ display: 'flex' }}>{stats.endTime !== null ? `HASTA · ${localTradeDate(stats.endTime)} · CDMX` : 'HASTA · Sin datos suficientes'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(229, 212, 182, 0.18)', color: '#A8AABA', fontSize: 18, lineHeight: 1.45 }}>
        <div style={{ display: 'flex' }}>Desde la primera apertura hasta el último cierre. Abiertas excluidas.</div>
        <div style={{ display: 'flex' }}>Reinversión teórica del 100%. Sin comisiones, slippage ni apalancamiento.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: gold, fontSize: 22 }}><span>gonovi.app</span><span>@gonovi_canal</span></div>
      </div>
      </div>
    </div>
    </div>
  )
}

export async function renderTradeCard(data: TradeCardData) {
  const response = new ImageResponse(tradeCardElement(data), { width: 1080, height: data.event === 'OPEN' ? 900 : data.event === 'SUMMARY' ? 1500 : 1660 })
  return new Uint8Array(await response.arrayBuffer())
}
