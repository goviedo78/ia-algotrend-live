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

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-2.5 text-xs">
      <span className="text-[#A8AABA]">{label}</span>
      <span className={`font-mono font-semibold ${color ?? 'text-[#E5D4B6]'}`}>{value}</span>
    </div>
  )
}

function ProbabilityBar(
  { label, value, fill, textColor, threshold }: { label: string; value: number; fill: string; textColor: string; threshold: number },
) {
  const pct = Math.round(value * 100)
  const isActive = value >= threshold

  return (
    <div className="rounded-2xl border border-[#4F5570] bg-[#1C223A] p-3">
      <div className="mb-2 flex items-end justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[#6B7385]">{label}</span>
        <span className={`font-mono text-xl font-semibold ${isActive ? textColor : 'text-[#6B7385]'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#2A3148]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  )
}

export default function StatsPanel({ stats, engine, connected, lastPrice }: StatsPanelProps) {
  const threshold = PRESET.probThreshold
  const thresholdPct = Math.round(threshold * 100)
  const currentProb = engine ? Math.max(engine.probUp, engine.probDown) : 0
  const progressPct = Math.min(100, Math.round((currentProb / Math.max(threshold, 0.01)) * 100))

  const stLabel = engine ? engine.lastStDir > 0 ? 'Alcista' : engine.lastStDir < 0 ? 'Bajista' : 'Neutral' : '—'
  const stClass = (engine?.lastStDir ?? 0) > 0
    ? 'text-[#4FBC72]'
    : (engine?.lastStDir ?? 0) < 0
      ? 'text-[#F44E1C]'
      : 'text-[#A8AABA]'

  const modeLabel = currentProb >= threshold ? 'Señal activa' : 'En observación'
  const modeClass = currentProb >= threshold
    ? (engine && engine.probUp >= engine.probDown ? 'text-[#4FBC72]' : 'text-[#F44E1C]')
    : 'text-[#A8AABA]'

  const pnlColor = (stats?.totalPnl ?? 0) >= 0 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'

  return (
    <aside className="flex flex-col gap-3 sm:gap-4">
      <section className="surface-panel px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="label-eyebrow">Estado del motor</p>
          <span className={`badge inline-flex items-center gap-1.5 ${connected ? 'badge-live' : 'badge-danger'}`}>
            {connected && <span className="live-dot" />}
            {connected ? 'EN VIVO' : 'SIN CONEXIÓN'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="surface-panel-muted px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">Precio BTC</p>
            <p className="mt-1 font-mono text-[1.05rem] font-semibold text-[#E5D4B6]">
              {lastPrice ? `$${lastPrice.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
            </p>
          </div>
          <div className="surface-panel-muted px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">{`ATR (${PRESET.atrPeriod})`}</p>
            <p className="mt-1 font-mono text-[1.05rem] font-semibold text-[#E5D4B6]">{engine ? engine.atrVal.toFixed(2) : '...'}</p>
          </div>
        </div>

        {engine ? (
          <div className="mt-4 space-y-2">
            <StatRow label="Filtro de IA" value="Motor Activo" color="text-[#A8AABA]" />
            <div className="flex items-center justify-between rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-2.5 text-xs">
              <span className="text-[#A8AABA]">Dirección del Algoritmo</span>
              <span className={`font-mono font-semibold ${stClass}`} style={{ textShadow: '0 0 10px rgba(244,78,28,0.40)' }}>
                {stLabel}
              </span>
            </div>
            <StatRow label="Modo del motor" value={modeLabel} color={modeClass} />

            <div className="rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-[#A8AABA]">Umbral de disparo</span>
                <span className="font-mono text-[#E5D4B6]">{thresholdPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#2A3148]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, backgroundColor: '#F44E1C' }}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-[#4F5570] pt-3">
              <ProbabilityBar label="Probabilidad alcista" value={engine.probUp} fill="#4FBC72" textColor="text-[#4FBC72]" threshold={threshold} />
              <ProbabilityBar label="Probabilidad bajista" value={engine.probDown} fill="#F44E1C" textColor="text-[#F44E1C]" threshold={threshold} />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-5 text-center text-xs text-[#A8AABA]">
            Cargando motor de IA...
          </div>
        )}
      </section>

      <section className="surface-panel px-4 py-4 sm:px-5 sm:py-5">
        <p className="label-eyebrow mb-3">Rendimiento</p>
        {stats ? (() => {
          const initialCapital = 10000
          const returnPct = ((stats.balance - initialCapital) / initialCapital) * 100
          const returnColor = returnPct >= 0 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'
          const avgPnl = stats.total > 0 ? (stats.totalPnl / stats.total) : 0
          const avgColor = avgPnl >= 0 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'
          return (
          <div className="space-y-2">
            {/* Highlight: Return % */}
            <div className="rounded-2xl border border-[#4F5570] bg-gradient-to-br from-[#1C223A] to-[#161C30] px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7385]">Rendimiento total</p>
              <p className={`mt-1 font-mono text-2xl font-bold ${returnColor}`}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
              </p>
              <p className="mt-0.5 text-[11px] text-[#6B7385]">
                Capital: <span className="text-[#E5D4B6]">${stats.balance.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span> (base $10,000)
              </p>
            </div>
            <StatRow label="PnL total" value={`${(stats.totalPnl ?? 0) >= 0 ? '+' : ''}$${(stats.totalPnl ?? 0).toFixed(2)}`} color={pnlColor} />
            <StatRow label="Promedio por trade" value={`${avgPnl >= 0 ? '+' : ''}$${avgPnl.toFixed(2)}`} color={avgColor} />
            <StatRow label="Tasa de acierto" value={`${(stats.winRate ?? 0).toFixed(1)}%`} color={(stats.winRate ?? 0) >= 50 ? 'text-[#4FBC72]' : 'text-[#F44E1C]'} />
            <StatRow label="Operaciones" value={`${stats.wins ?? 0}G / ${(stats.total ?? 0) - (stats.wins ?? 0)}P / ${stats.total ?? 0}T`} />
          </div>
          )
        })() : (
          <div className="rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-4 text-center text-xs text-[#A8AABA]">Aún no hay operaciones</div>
        )}
      </section>

      <section className="surface-panel px-4 py-4 sm:px-5 sm:py-5">
        <p className="label-eyebrow mb-3">Gestión de riesgo</p>
        <div className="space-y-2">
          <StatRow label="Stop Loss" value={`${PRESET.slPct}% (${PRESET.slMode})`} color="text-[#F44E1C]" />
          <StatRow label="Take Profit" value={`${PRESET.tpRR}:1 R:R (${PRESET.tpMode})`} color="text-[#4FBC72]" />
          <div className="rounded-xl border border-[#4F5570] bg-[#1C223A] px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A87A]"></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C9A87A]">Trailing Stop Activo</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#2A3148]/50 px-2.5 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-[#6B7385]">Trigger</p>
                <p className="font-mono text-sm font-semibold text-[#E5D4B6]">1.0%</p>
              </div>
              <div className="rounded-lg bg-[#2A3148]/50 px-2.5 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-[#6B7385]">Offset</p>
                <p className="font-mono text-sm font-semibold text-[#E5D4B6]">0.3%</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#6B7385] leading-relaxed">
              Cuando el precio sube 1% desde la entrada, el SL se mueve al precio de entrada y sigue al precio a 0.3% de distancia. El TP original se desactiva.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-panel px-4 py-4 sm:px-5 sm:py-5">
        <p className="label-eyebrow mb-3">Parámetros del modelo</p>
        <div className="space-y-1 text-[11px] text-[#A8AABA]">
          <div>ATR {PRESET.atrPeriod} · Factor {PRESET.factor} · K {PRESET.kNeighbors}</div>
          <div>Ventana {PRESET.samplingWindowSize} · Paso {PRESET.momentumWindow} · MA {PRESET.maType}</div>
          <div>RSI {PRESET.rsiLen} · CHOP {PRESET.chopLen} · p={PRESET.pParam} w={PRESET.wParam}</div>
        </div>
      </section>
    </aside>
  )
}
