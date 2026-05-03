'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import LoginGate from '@/components/admin/LoginGate'
import StatCard from '@/components/admin/StatCard'

const EquityChart = dynamic(() => import('@/components/admin/EquityChart'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────
interface DashboardData {
  trades: {
    total: number; wins: number; losses: number; winRate: number
    totalPnl: number; totalPnlPct: number; balance: number
    maxDrawdown: number; bestStreak: number; currentStreak: number; sharpe: number
    equityCurve: Array<{ time: number; balance: number }>
    monthly: Array<{ month: string; pnl: number }>
  }
  notifications: {
    pushSent: number; pushDevicesReached: number; pushFailed: number
    emailSent: number; emailFailed: number
    log: Array<{ type: string; title: string; devices: number; time: string }>
  }
  pageviews: {
    today: number; week: number; month: number; total: number; uniqueVisitors30d: number
    daily: Array<{ date: string; views: number; uniques: number }>
    countries: Array<{ country: string; count: number }>
    devices: Array<{ device: string; count: number }>
    referrers: Array<{ referrer: string; count: number }>
    peakHours: Array<{ hour: number; count: number }>
  }
  devices: {
    total: number
    devices: Array<{ endpoint: string; platform: string; registeredAt: string }>
  }
  sponsor: {
    impressions: number; clicks: number; ctr: number
  }
}

// ── Country flag helper ────────────────────────────────────────────
function countryFlag(code: string) {
  if (!code || code.length !== 2) return '🌍'
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

// ── Section component ──────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2 font-[var(--font-syne)]">
        <span className="text-xl">{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

// ── Mini bar chart (pure CSS) ──────────────────────────────────────
function MiniBar({ items, color = '#3B82F6' }: { items: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-xs">
          <span className="w-24 truncate text-[#9CA3AF]">{item.label}</span>
          <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div
              className="h-full rounded-md transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, background: color, opacity: 0.7 }}
            />
          </div>
          <span className="w-10 text-right font-mono text-[#E5E7EB]">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard Component ───────────────────────────────────────
function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Push composer state
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [pushSending, setPushSending] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; sent: number; error?: string } | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Settings state
  const [atrEnabled, setAtrEnabled] = useState(false)
  const [atrThreshold, setAtrThreshold] = useState(0.40)
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/stats')
      if (res.status === 401) {
        setError('Sesión expirada')
        return
      }
      const json = await res.json()
      if (json.ok) {
        setData(json)
        setLastRefresh(new Date())
      } else {
        setError(json.error || 'Error desconocido')
      }
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/settings')
      if (res.ok) {
        const json = await res.json()
        setAtrEnabled(json.atr_filter_enabled)
        setAtrThreshold(json.atr_threshold)
      }
    } catch (err) {
      console.error('Failed to load settings', err)
    }
  }, [])

  const updateSetting = async (key: 'atr_filter_enabled' | 'atr_threshold', value: boolean | number) => {
    setSavingSettings(true)
    try {
      const payload = { [key]: value }
      await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (key === 'atr_filter_enabled') setAtrEnabled(value as boolean)
      if (key === 'atr_threshold') setAtrThreshold(value as number)
    } catch (err) {
      console.error('Failed to save setting', err)
    }
    setSavingSettings(false)
  }

  /* eslint-disable react-hooks/set-state-in-effect -- Initial data fetch on mount + interval refresh is a standard dashboard pattern */
  useEffect(() => {
    fetchData()
    fetchSettings()
    const interval = setInterval(fetchData, 60000) // Auto-refresh every 60s
    return () => clearInterval(interval)
  }, [fetchData, fetchSettings])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-pulse">📊</div>
          <p className="text-[#9CA3AF] text-sm">Cargando estadísticas…</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">❌</div>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const t = data.trades
  const n = data.notifications
  const p = data.pageviews
  const d = data.devices
  const s = data.sponsor

  const mobileCount = p.devices.find(d => d.device === 'mobile')?.count ?? 0
  const desktopCount = p.devices.find(d => d.device === 'desktop')?.count ?? 0
  const mobilePercent = p.month > 0 ? ((mobileCount / p.month) * 100).toFixed(0) : '0'

  return (
    <div className="min-h-screen px-4 py-8 max-w-6xl mx-auto space-y-10">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-[var(--font-syne)] flex items-center gap-2">
            📊 AlgoTrend Analytics
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {lastRefresh ? `Actualizado: ${lastRefresh.toLocaleTimeString('es-MX')}` : 'Cargando…'}
            {loading && <span className="ml-2 animate-pulse">⟳</span>}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[#111827] border border-[#1F2937] text-sm text-[#9CA3AF] hover:text-white hover:border-[#3B82F6] transition-all disabled:opacity-40"
        >
          ⟳ Refrescar
        </button>
      </header>

      {/* ── 1. Rendimiento de trading ────────────────────────────── */}
      <Section title="Rendimiento de trading" icon="📈">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Tasa de acierto" value={`${t.winRate}%`} color={t.winRate >= 50 ? 'green' : 'red'} icon="🎯" />
          <StatCard label="Resultado total" value={`$${t.totalPnl.toLocaleString('es-MX')}`} color={t.totalPnl >= 0 ? 'green' : 'red'} icon="💰" />
          <StatCard label="Resultado %" value={`${t.totalPnlPct}%`} color={t.totalPnlPct >= 0 ? 'green' : 'red'} icon="📊" />
          <StatCard label="Máxima caída" value={`${t.maxDrawdown}%`} color="red" icon="📉" />
          <StatCard label="Sharpe" value={t.sharpe} color={t.sharpe > 1 ? 'green' : t.sharpe > 0 ? 'amber' : 'red'} icon="⚡" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Operaciones" value={t.total} icon="🔄" />
          <StatCard label="Ganadas / perdidas" value={`${t.wins} / ${t.losses}`} color="default" icon="📋" />
          <StatCard label="Mejor racha" value={t.bestStreak} color="green" icon="🔥" />
          <StatCard label="Balance" value={`$${t.balance.toLocaleString('es-MX')}`} color="cyan" icon="💎" large />
        </div>

        {/* Curva de balance */}
        {t.equityCurve.length > 1 && (
          <div className="rounded-xl border border-[#1F2937] p-4" style={{ background: 'rgba(17,24,39,0.6)' }}>
            <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Curva de balance (balance compuesto desde $10,000)</p>
            <EquityChart data={t.equityCurve} />
          </div>
        )}

        {/* Resultado mensual */}
        {t.monthly.length > 0 && (
          <div className="rounded-xl border border-[#1F2937] p-4" style={{ background: 'rgba(17,24,39,0.6)' }}>
            <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Resultado mensual (USD)</p>
            <MiniBar
              items={t.monthly.map(m => ({ label: m.month, value: m.pnl }))}
              color="#22C55E"
            />
          </div>
        )}
      </Section>

      {/* ── 1.5 Motor & Filtros ──────────────────────────────── */}
      <Section title="Motor de Trading" icon="⚙️">
        <div className="rounded-xl border border-[#1F2937] p-5" style={{ background: 'rgba(17,24,39,0.6)' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-medium flex items-center gap-2">
                Filtro de Volatilidad (ATR)
                {savingSettings && <span className="animate-pulse text-xs text-[#3B82F6]">Guardando...</span>}
              </h3>
              <p className="text-sm text-[#9CA3AF] mt-1 max-w-lg">
                Bloquea señales falsas cuando el mercado no tiene fuerza. Ignora trades si el ATR H1 es menor al umbral configurado.
              </p>
            </div>
            
            <div className="flex items-center gap-4 bg-[#0B1220] p-2 rounded-lg border border-[#1F2937]">
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs text-[#6B7280]">Umbral %</span>
                <input 
                  type="number" 
                  step="0.05"
                  min="0.1"
                  max="2.0"
                  value={atrThreshold}
                  onChange={(e) => setAtrThreshold(parseFloat(e.target.value))}
                  onBlur={(e) => updateSetting('atr_threshold', parseFloat(e.target.value))}
                  disabled={savingSettings || !atrEnabled}
                  className="w-16 bg-transparent text-white text-sm focus:outline-none disabled:opacity-50"
                />
              </div>
              
              <div className="h-6 w-px bg-[#1F2937]"></div>
              
              <button
                onClick={() => updateSetting('atr_filter_enabled', !atrEnabled)}
                disabled={savingSettings}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${atrEnabled ? 'bg-[#22C55E]' : 'bg-[#374151]'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${atrEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. Notifications ──────────────────────────────────── */}
      <Section title="Notificaciones" icon="🔔">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Push enviados" value={n.pushSent} color="blue" icon="📤" />
          <StatCard label="Dispositivos alcanzados" value={n.pushDevicesReached} color="cyan" icon="📱" />
          <StatCard label="Push fallidos" value={n.pushFailed} color={n.pushFailed > 0 ? 'red' : 'green'} icon="⚠️" />
          <StatCard label="Emails enviados" value={n.emailSent} color="blue" icon="✉️" />
        </div>

        {n.log.length > 0 && (
          <div className="rounded-xl border border-[#1F2937] overflow-hidden" style={{ background: 'rgba(17,24,39,0.6)' }}>
            <p className="text-xs uppercase tracking-wider text-[#6B7280] p-4 pb-2">Historial reciente</p>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#6B7280] border-b border-[#1F2937]">
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium">Mensaje</th>
                    <th className="text-right px-4 py-2 font-medium">Dispositivos</th>
                    <th className="text-right px-4 py-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {n.log.map((entry, i) => (
                    <tr key={i} className="border-b border-[#1F2937]/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-[#9CA3AF]">
                        {entry.type === 'push' ? '📤' : '✉️'} {entry.type}
                      </td>
                      <td className="px-4 py-2 text-white truncate max-w-48">{entry.title}</td>
                      <td className="px-4 py-2 text-right font-mono text-[#22D3EE]">{entry.devices}</td>
                      <td className="px-4 py-2 text-right text-[#6B7280]">
                        {new Date(entry.time).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Push Composer ──────────────────────────────────── */}
        <div
          className="rounded-xl border border-[#1F2937] p-5 space-y-4"
          style={{ background: 'rgba(17,24,39,0.6)' }}
        >
          <p className="text-xs uppercase tracking-wider text-[#6B7280] flex items-center gap-2">
            <span className="text-base">📣</span> Enviar notificación push manual
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[#6B7280]">Título</label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="🔔 AlgoTrend — Aviso"
                className="w-full rounded-lg bg-[#0B1220] border border-[#1F2937] px-3 py-2.5 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#6B7280]">Mensaje</label>
              <input
                type="text"
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Texto del mensaje…"
                className="w-full rounded-lg bg-[#0B1220] border border-[#1F2937] px-3 py-2.5 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
              onClick={async () => {
                setPushSending(true)
                setPushResult(null)
                try {
                  const res = await fetch('/api/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: pushTitle, body: pushBody, tag: 'manual-' + Date.now() }),
                  })
                  const json = await res.json()
                  setPushResult(json)
                  if (json.ok) {
                    setPushTitle('')
                    setPushBody('')
                    // Refresh stats to show the new push in the log
                    setTimeout(fetchData, 2000)
                  }
                } catch (err) {
                  setPushResult({ ok: false, sent: 0, error: String(err) })
                }
                setPushSending(false)
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-sm font-semibold hover:from-[#1D4ED8] hover:to-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25"
            >
              {pushSending ? '⟳ Enviando…' : '📤 Enviar Push'}
            </button>
            {pushResult && (
              <span className={`text-sm font-mono ${pushResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {pushResult.ok
                  ? `✅ Enviado a ${pushResult.sent} dispositivo${pushResult.sent !== 1 ? 's' : ''}`
                  : `❌ ${pushResult.error || 'Error'}`}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. Audiencia ──────────────────────────────────────── */}
      <Section title="Audiencia" icon="👥">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hoy" value={p.today} color="blue" icon="📅" />
          <StatCard label="Últimos 7 días" value={p.week} color="blue" icon="📆" />
          <StatCard label="Últimos 30 días" value={p.month} color="cyan" icon="📊" />
          <StatCard label="Visitantes únicos (30d)" value={p.uniqueVisitors30d} color="green" icon="👤" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily chart */}
          {p.daily.length > 0 && (
            <div className="rounded-xl border border-[#1F2937] p-4" style={{ background: 'rgba(17,24,39,0.6)' }}>
              <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Vistas diarias (30d)</p>
              <div className="flex items-end gap-[2px] h-32">
                {p.daily.map((d) => {
                  const max = Math.max(...p.daily.map(x => x.views), 1)
                  const h = (d.views / max) * 100
                  return (
                    <div key={d.date} className="flex-1 group relative">
                      <div
                        className="rounded-t-sm transition-all hover:opacity-100 opacity-70"
                        style={{ height: `${h}%`, minHeight: '2px', background: '#3B82F6' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#111827] border border-[#1F2937] text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                        {d.date}: {d.views} vistas, {d.uniques} únicos
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Countries */}
          {p.countries.length > 0 && (
            <div className="rounded-xl border border-[#1F2937] p-4" style={{ background: 'rgba(17,24,39,0.6)' }}>
              <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Países</p>
              <MiniBar
                items={p.countries.map(c => ({ label: `${countryFlag(c.country)} ${c.country}`, value: c.count }))}
                color="#22D3EE"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Devices */}
          <div className="rounded-xl border border-[#1F2937] p-4" style={{ background: 'rgba(17,24,39,0.6)' }}>
            <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Dispositivos</p>
            <div className="flex items-center gap-4">
              <div className="text-3xl">📱</div>
              <div>
                <p className="text-white font-mono text-lg">{mobilePercent}% mobile</p>
                <p className="text-[#6B7280] text-xs">{mobileCount} mobile · {desktopCount} desktop</p>
              </div>
            </div>
          </div>

          {/* Referrers */}
          {p.referrers.length > 0 && (
            <div className="rounded-xl border border-[#1F2937] p-4 sm:col-span-2" style={{ background: 'rgba(17,24,39,0.6)' }}>
              <p className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">Referrers</p>
              <MiniBar
                items={p.referrers.map(r => ({ label: r.referrer, value: r.count }))}
                color="#F59E0B"
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── 4. Dispositivos Push ───────────────────────────────── */}
      <Section title="Dispositivos Registrados" icon="📱">
        <StatCard label="Total suscripciones push" value={d.total} color="cyan" icon="🔔" />
        {d.devices.length > 0 && (
          <div className="rounded-xl border border-[#1F2937] overflow-hidden" style={{ background: 'rgba(17,24,39,0.6)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#1F2937]">
                  <th className="text-left px-4 py-2 font-medium">Plataforma</th>
                  <th className="text-left px-4 py-2 font-medium">Endpoint</th>
                  <th className="text-right px-4 py-2 font-medium">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {d.devices.map((dev, i) => (
                  <tr key={i} className="border-b border-[#1F2937]/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-white">
                      {dev.platform.includes('Apple') ? '🍎' : dev.platform.includes('Firefox') ? '🦊' : '🌐'} {dev.platform}
                    </td>
                    <td className="px-4 py-2 text-[#6B7280] font-mono truncate max-w-60">{dev.endpoint}</td>
                    <td className="px-4 py-2 text-right text-[#9CA3AF]">
                      {new Date(dev.registeredAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 5. Sponsor Report ─────────────────────────────────── */}
      <Section title="Sponsor Report" icon="🤝">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Impresiones" value={s.impressions} color="blue" icon="👁️" large />
          <StatCard label="Clicks" value={s.clicks} color="green" icon="👆" large />
          <StatCard label="CTR" value={`${s.ctr}%`} color={s.ctr > 1 ? 'green' : 'amber'} icon="📊" large />
          <StatCard label="Audiencia activa" value={d.total + p.uniqueVisitors30d} color="cyan" icon="👥" large subtitle={`${d.total} push + ${p.uniqueVisitors30d} visitantes`} />
        </div>
      </Section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-[#4B5563] py-8 border-t border-[#1F2937]">
        IA AlgoTrend Analytics Dashboard • Auto-refresh cada 60s
      </footer>
    </div>
  )
}

// ── Export with LoginGate wrapper ───────────────────────────────────
export default function DashboardPage() {
  return (
    <LoginGate>
      <AdminDashboard />
    </LoginGate>
  )
}
