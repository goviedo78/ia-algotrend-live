'use client'

import { PRESET } from '@/lib/algotrend'

interface Stats {
  total: number
  wins: number
  winRate: number
  totalPnl: number
  balance: number
}

interface EngineState {
  probUp: number
  probDown: number
  stDirection: number
  lastStDir: number
  atrVal: number
}

interface StatsPanelProps {
  stats: Stats | null
  engine: EngineState | null
  connected: boolean
  lastPrice: number | null
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 px-3 even:bg-[#0c0c1a]">
      <span className="text-[#4a5a6a] text-xs">{label}</span>
      <span className={`text-xs font-mono font-semibold ${color ?? 'text-gray-300'}`}>{value}</span>
    </div>
  )
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100)
  const isActive = value >= PRESET.probThreshold
  return (
    <div className="px-3 py-1.5 even:bg-[#0c0c1a]">
      <div className="flex justify-between mb-1">
        <span className="text-[#4a5a6a] text-xs">{label}</span>
        <span className={`text-xs font-mono font-bold ${isActive ? color : 'text-gray-500'}`}>
          {pct}% {isActive ? '✓' : ''}
        </span>
      </div>
      <div className="h-1 bg-[#1a1a30] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: isActive ? (color === 'text-[#289eff]' ? '#289eff' : '#ce3f6c') : '#374151' }}
        />
      </div>
    </div>
  )
}

export default function StatsPanel({ stats, engine, connected, lastPrice }: StatsPanelProps) {
  const thresh = PRESET.probThreshold

  const stLabel = engine
    ? engine.lastStDir > 0 ? 'ALCISTA' : engine.lastStDir < 0 ? 'BAJISTA' : 'NEUTRAL'
    : '—'
  const stColor = (engine?.lastStDir ?? 0) > 0 ? 'text-[#289eff]' : (engine?.lastStDir ?? 0) < 0 ? 'text-[#ce3f6c]' : 'text-gray-500'

  const probActual = engine ? Math.max(engine.probUp, engine.probDown) : 0
  const isSignalActive = probActual >= thresh
  const statusColor = isSignalActive
    ? (engine && engine.probUp > engine.probDown ? 'text-[#289eff]' : 'text-[#ce3f6c]')
    : 'text-gray-500'
  const statusText = isSignalActive ? 'SEÑAL ACTIVA' : 'Esperando'

  const distToThresh = (thresh - probActual) * 100
  const distColor = distToThresh <= 0 ? 'text-[#00e676]' : distToThresh < 5 ? 'text-yellow-400' : 'text-gray-400'
  const distText  = distToThresh <= 0 ? 'Umbral superado' : `${distToThresh.toFixed(1)}% al umbral`

  const pnlColor = (stats?.totalPnl ?? 0) >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'

  return (
    <div className="flex flex-col gap-3">

      {/* Engine panel */}
      <div className="bg-[#080812] border border-[#1a1a30] rounded-lg overflow-hidden">
        <div className="bg-[#04040e] px-3 py-2 flex items-center justify-between border-b border-[#14142a]">
          <span className="text-[#289eff] text-xs font-bold tracking-widest">🤖 IA AlgoTrend</span>
          <span className={`text-xs flex items-center gap-1 ${connected ? 'text-[#00e676]' : 'text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#00e676] animate-pulse' : 'bg-gray-600'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {lastPrice && (
          <div className="px-3 py-2 text-center border-b border-[#14142a]">
            <span className="text-white text-xl font-mono font-bold">
              ${lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[#4a5a6a] text-xs ml-2">BTC/USDT</span>
          </div>
        )}

        {engine ? (
          <>
            <Row label="Preset"       value="Cripto · Intraday" color="text-yellow-400" />
            <Row label="SuperTrend"   value={stLabel}           color={stColor} />
            <Row label="Estado motor" value={statusText}        color={statusColor} />
            <Row label="Distancia"    value={distText}          color={distColor} />
            <Row label="Umbral"       value={`${(thresh * 100).toFixed(0)}%`} />
            <Row label="ATR (8)"      value={engine.atrVal.toFixed(2)} />

            <div className="border-t border-[#14142a] pt-1 pb-1">
              <ProbBar label="Prob. alcista" value={engine.probUp}   color="text-[#289eff]" />
              <ProbBar label="Prob. bajista" value={engine.probDown} color="text-[#ce3f6c]" />
            </div>
          </>
        ) : (
          <div className="px-3 py-6 text-center text-[#4a5a6a] text-xs">
            Cargando KNN engine...
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="bg-[#080812] border border-[#1a1a30] rounded-lg overflow-hidden">
        <div className="bg-[#04040e] px-3 py-2 border-b border-[#14142a]">
          <span className="text-[#289eff] text-xs font-bold tracking-widest">PERFORMANCE</span>
        </div>
        {stats ? (
          <>
            <Row label="Balance"   value={`$${stats.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
            <Row label="PnL total" value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`} color={pnlColor} />
            <Row label="Win rate"  value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'text-[#00e676]' : 'text-[#ff1744]'} />
            <Row label="Trades"    value={`${stats.wins}W / ${stats.total - stats.wins}L / ${stats.total}T`} />
          </>
        ) : (
          <div className="px-3 py-4 text-center text-[#4a5a6a] text-xs">Sin trades aún</div>
        )}
      </div>

      {/* Params */}
      <div className="bg-[#080812] border border-[#1a1a30] rounded-lg overflow-hidden text-[10px] text-[#4a5a6a]">
        <div className="px-3 py-2 space-y-0.5">
          <div>ATR {PRESET.atrPeriod} · Factor {PRESET.factor} · K {PRESET.kNeighbors}</div>
          <div>Ventana {PRESET.samplingWindowSize} · Paso {PRESET.momentumWindow} · MA {PRESET.maType}</div>
          <div>RSI {PRESET.rsiLen} · CHOP {PRESET.chopLen} · p={PRESET.pParam} w={PRESET.wParam}</div>
        </div>
      </div>

    </div>
  )
}
