import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'NFC Analytics | GONOVI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ pin?: string }>
}

const VALID_PIN = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD

interface NfcScan {
  id: string
  card_id: string
  ip_hash: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  region: string | null
  latitude: string | null
  longitude: string | null
  browser_language: string | null
  device_cookie_id: string | null
  referer: string | null
  created_at: string
}

export default async function NfcAnalyticsPage({ searchParams }: Props) {
  const { pin } = await searchParams

  if (!VALID_PIN || pin !== VALID_PIN) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0d1122',
        color: 'rgba(229,212,182,0.62)',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.76rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
          <p>Panel privado NFC — se requiere PIN</p>
          <p style={{ color: 'rgba(229,212,182,0.32)', fontSize: '0.64rem' }}>
            Agregar <code>?pin=TU_PIN</code> a la URL
          </p>
          <Link href="/official" style={{ color: '#ff8a60', textDecoration: 'none' }}>← Volver al inicio</Link>
        </div>
      </main>
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('nfc_analytics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const scans: NfcScan[] = data ?? []

  // Stats computation
  const totalScans = scans.length
  const uniqueDevices = new Set(scans.map(s => s.device_cookie_id).filter(Boolean)).size
  
  const cardCounts: Record<string, number> = {}
  for (const scan of scans) {
    cardCounts[scan.card_id] = (cardCounts[scan.card_id] || 0) + 1
  }
  const topCards = Object.entries(cardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0d1122',
      color: '#e5d4b6',
      fontFamily: 'ui-monospace, monospace',
      padding: '2rem',
    }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#ff8a60' }}>NFC Analytics</h1>
          <p style={{ opacity: 0.6, fontSize: '0.8rem' }}>Últimos 500 escaneos</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href={`/official/analytics?pin=${pin}`} style={{ color: 'rgba(229,212,182,0.6)', textDecoration: 'none', border: '1px solid rgba(229,212,182,0.2)', padding: '0.5rem 1rem', borderRadius: '4px' }}>
            ← Analytics General
          </Link>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'rgba(229,212,182,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Total Escaneos</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalScans}</div>
        </div>
        <div style={{ background: 'rgba(229,212,182,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Dispositivos Únicos</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{uniqueDevices}</div>
        </div>
        <div style={{ background: 'rgba(229,212,182,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Top Card ID</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {topCards.length > 0 ? topCards.map(([id, count]) => (
              <span key={id}>{id}: <span style={{ opacity: 0.5 }}>{count}</span></span>
            )) : <span>-</span>}
          </div>
        </div>
      </section>

      {error ? (
        <div style={{ color: '#f44e1c', padding: '1rem', background: 'rgba(244,78,28,0.1)', borderRadius: '4px' }}>
          Error cargando datos: {error.message}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(229,212,182,0.2)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Fecha (Arg)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Card ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ubicación</th>
                <th style={{ padding: '0.75rem 1rem' }}>Idioma</th>
                <th style={{ padding: '0.75rem 1rem' }}>Dispositivo</th>
                <th style={{ padding: '0.75rem 1rem' }}>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => {
                // Formatear fecha a Argentina
                const date = new Date(scan.created_at)
                const dateString = new Intl.DateTimeFormat('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires',
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                }).format(date)

                const location = [scan.city, scan.country].filter(Boolean).join(', ') || 'Desconocido'
                const ua = scan.user_agent || ''
                const uaTruncated = ua.length > 80 ? ua.substring(0, 80) + '...' : ua
                const device = scan.device_cookie_id ? scan.device_cookie_id.substring(0, 8) : 'N/A'

                return (
                  <tr key={scan.id} style={{ borderBottom: '1px solid rgba(229,212,182,0.05)' }}>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{dateString}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: '#ff8a60', color: '#0d1122', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                        {scan.card_id}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{location}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{scan.browser_language || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem' }} title={scan.device_cookie_id || ''}>
                      <code>{device}</code>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }} title={ua}>
                      {uaTruncated}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {scans.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
              No hay escaneos registrados aún.
            </div>
          )}
        </div>
      )}
    </main>
  )
}
