import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { RefreshButton } from '@/components/official/analytics/RefreshButton'
import { InfoTooltip } from '@/components/official/InfoTooltip'
import { UtmBuilder } from './UtmBuilder'
import { LocalTime } from './LocalTime'
import styles from './LinksAnalytics.module.css'

interface ViewRow {
  id: number
  session_id: string | null
  ip_hash: string | null
  country: string | null
  city: string | null
  region: string | null
  user_agent: string | null
  browser_language: string | null
  referer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
}

interface ClickRow {
  id: number
  session_id: string | null
  link_index: number | null
  link_title: string | null
  link_href: string | null
  country: string | null
  city: string | null
  utm_source: string | null
  utm_medium: string | null
  referer: string | null
  created_at: string
}

// Reglas para clasificar la "fuente" de un visitante combinando UTM + referrer.
// Si el visitante trae utm_source ese gana (alta confianza, dimos el link nosotros).
// Si no, intentamos derivar del host del referrer. Si no hay referrer = directo.
function getSource(row: { utm_source: string | null; referer: string | null }): {
  key: string
  label: string
  confidence: 'utm' | 'referrer' | 'direct'
} {
  if (row.utm_source) {
    const src = row.utm_source.toLowerCase()
    return { key: `utm:${src}`, label: src, confidence: 'utm' }
  }
  if (row.referer) {
    try {
      const url = new URL(row.referer)
      const host = url.hostname.replace(/^www\./, '')
      const map: Record<string, string> = {
        'instagram.com': 'Instagram',
        'l.instagram.com': 'Instagram',
        'tiktok.com': 'TikTok',
        'vm.tiktok.com': 'TikTok',
        'youtube.com': 'YouTube',
        'youtu.be': 'YouTube',
        'm.youtube.com': 'YouTube',
        'twitter.com': 'Twitter/X',
        'x.com': 'Twitter/X',
        't.co': 'Twitter/X',
        'facebook.com': 'Facebook',
        'l.facebook.com': 'Facebook',
        'lm.facebook.com': 'Facebook',
        'linkedin.com': 'LinkedIn',
        'reddit.com': 'Reddit',
        'google.com': 'Google',
        'whatsapp.com': 'WhatsApp',
        'api.whatsapp.com': 'WhatsApp',
        'wa.me': 'WhatsApp',
        'gonovi.app': 'Interno (gonovi.app)',
      }
      const label = map[host] ?? host
      return { key: `ref:${host}`, label, confidence: 'referrer' }
    } catch {
      return { key: 'ref:invalid', label: 'Referrer inválido', confidence: 'referrer' }
    }
  }
  return { key: 'direct', label: 'Directo / app sin referrer', confidence: 'direct' }
}

function startOfDayUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pickDevice(ua: string | null): string {
  if (!ua) return 'Desconocido'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Otro'
}

interface Props {
  pin: string
}

export async function LinksAnalytics({ pin }: Props) {
  const supabase = createAdminClient()

  // Ventana de los últimos 30 días. El insert se hace en UTC y created_at es
  // TIMESTAMPTZ, así que comparamos en UTC.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [viewsRes, clicksRes] = await Promise.all([
    supabase
      .from('link_views')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('link_clicks')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const views: ViewRow[] = (viewsRes.data ?? []) as ViewRow[]
  const clicks: ClickRow[] = (clicksRes.data ?? []) as ClickRow[]
  const error = viewsRes.error ?? clicksRes.error

  const totalViews = views.length
  const uniqueSessions = new Set(views.map((v) => v.session_id).filter(Boolean)).size
  const totalClicks = clicks.length
  const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0

  // ── Top fuentes (utm + referrer combinados)
  const sourceCounts = new Map<string, { label: string; views: number; clicks: number; confidence: string }>()
  for (const v of views) {
    const src = getSource(v)
    const existing = sourceCounts.get(src.key)
    if (existing) existing.views++
    else sourceCounts.set(src.key, { label: src.label, views: 1, clicks: 0, confidence: src.confidence })
  }
  for (const c of clicks) {
    const src = getSource(c)
    const existing = sourceCounts.get(src.key)
    if (existing) existing.clicks++
    else sourceCounts.set(src.key, { label: src.label, views: 0, clicks: 1, confidence: src.confidence })
  }
  const topSources = Array.from(sourceCounts.values())
    .sort((a, b) => b.views + b.clicks - (a.views + a.clicks))
    .slice(0, 10)

  // ── Top links (por título)
  const linkCounts = new Map<string, { title: string; href: string | null; clicks: number }>()
  for (const c of clicks) {
    const key = c.link_title ?? 'Sin título'
    const existing = linkCounts.get(key)
    if (existing) existing.clicks++
    else linkCounts.set(key, { title: key, href: c.link_href, clicks: 1 })
  }
  const topLinks = Array.from(linkCounts.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 12)

  // ── Geo (top 8 países)
  const countryCounts = new Map<string, number>()
  for (const v of views) {
    const c = v.country?.toUpperCase() || 'Desconocido'
    countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
  }
  const topCountries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // ── Time series últimos 14 días
  const days: { date: string; views: number; clicks: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push({ date: startOfDayUtc(d), views: 0, clicks: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  for (const v of views) {
    const key = v.created_at.substring(0, 10)
    const i = dayIndex.get(key)
    if (i !== undefined) days[i].views++
  }
  for (const c of clicks) {
    const key = c.created_at.substring(0, 10)
    const i = dayIndex.get(key)
    if (i !== undefined) days[i].clicks++
  }
  const maxBar = Math.max(1, ...days.map((d) => Math.max(d.views, d.clicks)))

  // ── Dispositivos
  const deviceCounts = new Map<string, number>()
  for (const v of views) {
    const d = pickDevice(v.user_agent)
    deviceCounts.set(d, (deviceCounts.get(d) ?? 0) + 1)
  }
  const topDevices = Array.from(deviceCounts.entries()).sort((a, b) => b[1] - a[1])

  // Últimas 20 visitas para tabla de detalle
  const recentViews = views.slice(0, 20)

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Analytics · /links</h1>
          <p className={styles.headerSubtitle}>
            Últimos 30 días · {totalViews} visitas, {totalClicks} clicks, {uniqueSessions} visitantes únicos
          </p>
        </div>
        <div className={styles.headerControls}>
          <RefreshButton />
          <Link href={`/official/links?pin=${pin}`} className={styles.headerLink}>
            ← Volver al editor
          </Link>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          Error cargando datos: {error.message}
        </div>
      )}

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Visitas totales</div>
          <div className={styles.statValue}>{totalViews}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            Visitantes únicos
            <InfoTooltip
              title="Visitantes únicos"
              body="Cada navegador recibe un session_id al primer view (guardado en localStorage del visitante). Si la misma persona vuelve, suma 1 visita pero el mismo session_id. Si borra storage o usa incógnito, cuenta como nuevo."
              example="5 visitas del mismo iPhone = 5 visitas, 1 visitante único."
              align="left"
            />
          </div>
          <div className={styles.statValue}>{uniqueSessions}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Clicks en links</div>
          <div className={styles.statValue}>{totalClicks}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            CTR
            <InfoTooltip
              title="Click-through Rate"
              body="Porcentaje de visitas que terminaron tocando algún link. CTR alto = la página convierte bien. CTR bajo = la gente entra y se va sin tocar nada."
              example="100 visitas, 35 clicks → CTR 35%."
              align="left"
            />
          </div>
          <div className={styles.statValue}>{ctr.toFixed(1)}%</div>
        </div>
      </section>

      <section className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Actividad · últimos 14 días</h2>
        <div className={styles.barChart}>
          {days.map((d) => (
            <div key={d.date} className={styles.barCol} title={`${d.date} · ${d.views} visitas · ${d.clicks} clicks`}>
              <div className={styles.barStack}>
                <div
                  className={styles.barViews}
                  style={{ height: `${(d.views / maxBar) * 100}%` }}
                  aria-label={`${d.views} visitas`}
                />
                <div
                  className={styles.barClicks}
                  style={{ height: `${(d.clicks / maxBar) * 100}%` }}
                  aria-label={`${d.clicks} clicks`}
                />
              </div>
              <div className={styles.barLabel}>{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className={styles.barLegend}>
          <span><span className={`${styles.barDot} ${styles.barDotViews}`} /> Visitas</span>
          <span><span className={`${styles.barDot} ${styles.barDotClicks}`} /> Clicks</span>
        </div>
      </section>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>
            Top fuentes
            <InfoTooltip
              title="De dónde vienen las visitas"
              body="Combina UTMs (cuando vos compartiste el link con ?utm_source=...) y referrer del navegador. Los UTMs son confiables; el referrer suele faltar cuando vienen de apps móviles (Instagram, TikTok, WhatsApp). Para no perder data, usá el generador de UTMs."
              example="UTM = etiqueta UTM en el link. Referrer = host del navegador. Directo = sin ninguno de los dos (típico de apps que borran el referrer)."
              align="right"
            />
          </h2>
          {topSources.length === 0 ? (
            <p className={styles.empty}>Sin datos todavía.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th className={styles.numCell}>Visitas</th>
                  <th className={styles.numCell}>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map((s) => (
                  <tr key={s.label}>
                    <td>
                      <span className={styles.sourceLabel}>{s.label}</span>
                      {s.confidence === 'utm' && <span className={styles.confChip}>UTM</span>}
                      {s.confidence === 'direct' && <span className={styles.confChipMuted}>directo</span>}
                    </td>
                    <td className={styles.numCell}>{s.views}</td>
                    <td className={styles.numCell}>{s.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Top links tocados</h2>
          {topLinks.length === 0 ? (
            <p className={styles.empty}>Sin clicks aún.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Link</th>
                  <th className={styles.numCell}>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {topLinks.map((l) => (
                  <tr key={l.title}>
                    <td>
                      <div className={styles.linkTitle}>{l.title}</div>
                      {l.href && <code className={styles.linkHref}>{l.href}</code>}
                    </td>
                    <td className={styles.numCell}>{l.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Geo</h2>
          {topCountries.length === 0 ? (
            <p className={styles.empty}>Sin datos.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>País</th>
                  <th className={styles.numCell}>Visitas</th>
                </tr>
              </thead>
              <tbody>
                {topCountries.map(([country, count]) => (
                  <tr key={country}>
                    <td>{country}</td>
                    <td className={styles.numCell}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Dispositivos</h2>
          {topDevices.length === 0 ? (
            <p className={styles.empty}>Sin datos.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Dispositivo</th>
                  <th className={styles.numCell}>Visitas</th>
                </tr>
              </thead>
              <tbody>
                {topDevices.map(([dev, count]) => (
                  <tr key={dev}>
                    <td>{dev}</td>
                    <td className={styles.numCell}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <UtmBuilder />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Últimas 20 visitas</h2>
        {recentViews.length === 0 ? (
          <p className={styles.empty}>Sin visitas aún.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>País</th>
                  <th>Fuente</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {recentViews.map((v) => {
                  const src = getSource(v)
                  return (
                    <tr key={v.id}>
                      <td><LocalTime iso={v.created_at} /></td>
                      <td>{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                      <td>
                        {src.label}
                        {src.confidence === 'utm' && <span className={styles.confChip}>UTM</span>}
                      </td>
                      <td>{pickDevice(v.user_agent)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
