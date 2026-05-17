import Link from 'next/link'
import type {
  getCardClickStats,
  getDeviceStats,
  getNotificationStats,
  getPageviewStats,
  getSponsorStats,
  getTradePerformanceStats,
} from '@/lib/analytics'
import { ScenarioCountsTable } from './ScenarioCountsTable'
import s from './analytics-dashboard.module.css'

type Stats = {
  devices: Awaited<ReturnType<typeof getDeviceStats>>
  notifications: Awaited<ReturnType<typeof getNotificationStats>>
  pageviews: Awaited<ReturnType<typeof getPageviewStats>>
  sponsor: Awaited<ReturnType<typeof getSponsorStats>>
  trades: Awaited<ReturnType<typeof getTradePerformanceStats>>
} | null

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={s.metricCard}>
      <span className={s.metricLabel}>{label}</span>
      <strong className={s.metricValue}>{typeof value === 'number' ? fmt(value) : value}</strong>
      {sub && <small className={s.metricSub}>{sub}</small>}
    </div>
  )
}

type CardClick = Awaited<ReturnType<typeof getCardClickStats>>[number]

export function AnalyticsDashboard({ stats, cardClicks = [] }: { stats: Stats; cardClicks?: CardClick[] }) {
  const now = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const pageviews = stats?.pageviews
  const topDevice = pageviews?.devices.sort((a, b) => b.count - a.count)[0]
  const topCountry = pageviews?.countries[0]

  return (
    <main className={s.shell}>
      <header className={s.header}>
        <div>
          <span className={s.kicker}>GONOVI · Analytics Interno</span>
          <h1 className={s.title}>Dashboard de tráfico</h1>
          <small className={s.updated}>Actualizado {now}</small>
        </div>
        <Link href="/official" className={s.backLink}>← Volver al landing</Link>
      </header>

      {!stats ? (
        <>
          <p className={s.error}>No se pudo cargar los datos. Verificá la conexión con Supabase.</p>
          <section className={s.tableGrid}>
            <ScenarioCountsTable />
          </section>
        </>
      ) : (
        <>
          {/* metrics row */}
          <section className={s.metricsGrid}>
            <MetricCard label="Hoy" value={pageviews?.today ?? 0} sub="pageviews" />
            <MetricCard label="Esta semana" value={pageviews?.week ?? 0} sub="pageviews" />
            <MetricCard label="Este mes" value={pageviews?.month ?? 0} sub="pageviews" />
            <MetricCard label="Total acumulado" value={pageviews?.total ?? 0} sub="pageviews" />
            <MetricCard label="Visitantes únicos" value={pageviews?.uniqueVisitors30d ?? 0} sub="últimos 30 días" />
            <MetricCard label="Dispositivo top" value={topDevice?.device ?? '—'} sub={topDevice ? `${fmt(topDevice.count)} vistas` : undefined} />
            <MetricCard label="País top" value={topCountry?.country ?? '—'} sub={topCountry ? `${fmt(topCountry.count)} vistas` : undefined} />
            <MetricCard label="Push devices" value={stats.devices.total} sub="suscripciones" />
            <MetricCard label="Push enviados" value={stats.notifications.pushSent} sub={`${stats.notifications.pushDevicesReached} dispositivos`} />
            <MetricCard label="Sponsor CTR" value={`${stats.sponsor.ctr}%`} sub={`${stats.sponsor.clicks}/${stats.sponsor.impressions}`} />
            <MetricCard label="Trades cerrados" value={stats.trades.total} sub={`${stats.trades.winRate}% WR`} />
            <MetricCard label="Balance modelo" value={`$${fmt(stats.trades.balance)}`} sub={`${stats.trades.totalPnlPct}%`} />
            <MetricCard label="Max DD" value={`${stats.trades.maxDrawdown}%`} sub="drawdown" />
          </section>

          {/* daily chart (simple bar) */}
          {pageviews && pageviews.daily.length > 0 && (
            <section className={s.chartSection}>
              <h2 className={s.sectionTitle}>Pageviews por día (últimos 30 días)</h2>
              <div className={s.barChart}>
                {(() => {
                  const max = Math.max(...pageviews.daily.map((x) => x.views), 1)
                  return pageviews.daily.slice(-30).map((d) => {
                  const pct = Math.round((d.views / max) * 100)
                  return (
                    <div key={d.date} className={s.barCol} title={`${d.date}: ${d.views} vistas`}>
                      <div className={s.bar} style={{ height: `${pct}%` }} />
                      <span className={s.barLabel}>{d.date.slice(5)}</span>
                    </div>
                  )
                })
                })()}
              </div>
            </section>
          )}

          {/* countries + devices + referrers */}
          <section className={s.tableGrid}>
            {pageviews && pageviews.countries.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>Países</h2>
                <table className={s.table}>
                  <tbody>
                    {pageviews.countries.slice(0, 8).map((c) => (
                      <tr key={c.country}>
                        <td>{c.country || '—'}</td>
                        <td className={s.tdRight}>{fmt(c.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageviews && pageviews.devices.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>Dispositivos</h2>
                <table className={s.table}>
                  <tbody>
                    {pageviews.devices.map((d) => (
                      <tr key={d.device}>
                        <td>{d.device}</td>
                        <td className={s.tdRight}>{fmt(d.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageviews && pageviews.referrers.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>Fuentes de tráfico</h2>
                <table className={s.table}>
                  <tbody>
                    {pageviews.referrers.slice(0, 8).map((r) => (
                      <tr key={r.referrer}>
                        <td>{r.referrer}</td>
                        <td className={s.tdRight}>{fmt(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageviews && pageviews.peakHours.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>Horas pico (UTC)</h2>
                <table className={s.table}>
                  <tbody>
                    {pageviews.peakHours.map((h) => (
                      <tr key={h.hour}>
                        <td>{String(h.hour).padStart(2, '0')}:00 UTC</td>
                        <td className={s.tdRight}>{fmt(h.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={s.tableGrid}>
            <ScenarioCountsTable />

            {stats.notifications.log.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>Ultimas notificaciones</h2>
                <table className={s.table}>
                  <tbody>
                    {stats.notifications.log.slice(0, 8).map((item) => (
                      <tr key={`${item.type}-${item.time}-${item.title}`}>
                        <td>{item.title}</td>
                        <td className={s.tdRight}>{item.devices}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {stats.trades.monthly.length > 0 && (
              <div className={s.tableCard}>
                <h2 className={s.sectionTitle}>PnL mensual</h2>
                <table className={s.table}>
                  <tbody>
                    {stats.trades.monthly.slice(-8).map((item) => (
                      <tr key={item.month}>
                        <td>{item.month}</td>
                        <td className={s.tdRight}>${fmt(item.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {pageviews && pageviews.today === 0 && pageviews.total === 0 && (
            <p className={s.emptyNote}>
              Sin datos aún. El tracking se activa cuando los visitantes carguen el landing con el script habilitado.
            </p>
          )}

          {cardClicks.length > 0 && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Clicks por tarjeta del Hub (30 días)</h2>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>ID</th><th>Tarjeta</th><th className={s.tdRight}>Clicks</th></tr>
                  </thead>
                  <tbody>
                    {cardClicks.map((c) => (
                      <tr key={c.id}>
                        <td className={s.tdMuted}>{c.id}</td>
                        <td>{c.title}</td>
                        <td className={s.tdRight}>{c.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
