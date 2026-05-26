import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { InfoTooltip } from '@/components/official/InfoTooltip'
import { NfcLocalTime } from '@/components/official/analytics/NfcLocalTime'
import { CardNameForm } from '@/components/official/analytics/CardNameForm'
import { RefreshButton } from '@/components/official/analytics/RefreshButton'

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

interface CardName {
  card_id: string
  name: string
  redirect_url: string | null
}

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: '—', browser: '—' }
  let device = 'PC'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Macintosh/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Linux/i.test(ua)) device = 'Linux'

  let browser = 'otro'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'

  return { device, browser }
}

export default async function NfcAnalyticsPage({ searchParams }: Props) {
  const { pin } = await searchParams

  if (!VALID_PIN || pin !== VALID_PIN) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#14120E', // Ink background from 3D hero
          color: 'rgba(240,236,228,0.62)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.76rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
          <p>Panel privado NFC — se requiere PIN</p>
          <p style={{ color: 'rgba(240,236,228,0.32)', fontSize: '0.64rem' }}>
            Agregar <code>?pin=TU_PIN</code> a la URL
          </p>
          <Link href="/official" style={{ color: '#ff8a3d', textDecoration: 'none' }}>
            ← Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  const supabase = createAdminClient()
  const [scansRes, namesRes] = await Promise.all([
    supabase.from('nfc_analytics').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('nfc_card_names').select('card_id, name, redirect_url').order('card_id'),
  ])

  const scans: NfcScan[] = scansRes.data ?? []
  const names: CardName[] = namesRes.data ?? []
  const error = scansRes.error
  const nameByCard = new Map(names.map((n) => [n.card_id, n.name]))

  const totalScans = scans.length
  const uniqueDevices = new Set(scans.map((s) => s.device_cookie_id).filter(Boolean)).size

  const cardCounts: Record<string, number> = {}
  for (const scan of scans) {
    cardCounts[scan.card_id] = (cardCounts[scan.card_id] || 0) + 1
  }
  const topCards = Object.entries(cardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const cellStyle: React.CSSProperties = { padding: '0.75rem 1rem' }
  const headStyle: React.CSSProperties = { padding: '0.75rem 1rem', whiteSpace: 'nowrap' }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#14120E', // Ink
        color: '#F0ECE4',      // Bone
        fontFamily: 'ui-monospace, monospace',
        padding: '2rem',
      }}
    >
      <header
        style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#ff8a3d' }}>NFC Analytics</h1>
          <p style={{ opacity: 0.6, fontSize: '0.8rem' }}>Últimos 500 escaneos · hora local de tu navegador</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <RefreshButton />
          <Link
            href={`/official/analytics?pin=${pin}`}
            style={{
              color: 'rgba(240,236,228,0.6)',
              textDecoration: 'none',
              border: '1px solid rgba(240,236,228,0.2)',
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ← Analytics General
          </Link>
        </div>
      </header>

      <CardNameForm pin={pin ?? ''} named={names} />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ background: 'rgba(240,236,228,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Total Escaneos</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalScans}</div>
        </div>
        <div style={{ background: 'rgba(240,236,228,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Dispositivos Únicos
            <InfoTooltip
              title="Dispositivos únicos"
              body="Cada navegador recibe una cookie con un identificador al primer escaneo. Si la misma persona escanea 5 veces con su teléfono, suma 1 dispositivo. Si cambia de teléfono o borra cookies, cuenta como nuevo."
              example="3 escaneos del mismo iPhone = 1 dispositivo único. 3 escaneos desde 3 teléfonos distintos = 3 dispositivos únicos."
              align="left"
            />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{uniqueDevices}</div>
        </div>
        <div style={{ background: 'rgba(240,236,228,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Top Tarjetas Físicas</div>
          <div style={{ fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {topCards.length > 0 ? (
              topCards.map(([id, count]) => (
                <span key={id}>
                  <span style={{ fontWeight: 700 }}>{nameByCard.get(id) ?? id}</span>{' '}
                  <span style={{ opacity: 0.5 }}>({count})</span>
                </span>
              ))
            ) : (
              <span>—</span>
            )}
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
              <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.2)' }}>
                <th style={headStyle}>
                  Fecha
                  <InfoTooltip
                    title="Fecha y hora del escaneo"
                    body="Convertida a la hora local de tu navegador automáticamente. Pasá el mouse sobre el valor para ver la hora UTC original (la que está guardada en la base)."
                    example="Si escanean a las 20:15 hora Argentina y vos abrís el dashboard desde Madrid, ves '01:15' (hora Madrid)."
                    align="left"
                  />
                </th>
                <th style={headStyle}>
                  Tarjeta Física (ID)
                  <InfoTooltip
                    title="ID Físico de la Tarjeta"
                    body="Es el identificador grabado en el chip NFC de la tarjeta real (ej. b1, vip7). Corresponde a la ruta corta en la URL (gonovi.app/x/b1). Si le asignaste un nombre arriba, ves el nombre en lugar del código. Pasá el mouse para ver el código físico original."
                    example="Grabaste la URL /x/b1 en tu tarjeta negra. Al escanearla, aquí aparecerá 'b1'."
                    align="left"
                  />
                </th>
                <th style={headStyle}>
                  Ubicación
                  <InfoTooltip
                    title="Ubicación aproximada por IP"
                    body="Vercel detecta país, ciudad y región según la IP. Precisión típica: 10-50 km en zonas urbanas, peor en zonas rurales. NO es la calle exacta — para eso habría que pedir permiso GPS al visitante (rompe lo discreto del NFC). Hacé clic en el pin 📍 para abrir Google Maps con la lat/lon aproximada."
                    example="Buenos Aires, AR (Argentina) — radio ~15 km. El pin te lleva al barrio aproximado, no a la calle."
                    align="left"
                  />
                </th>
                <th style={headStyle}>
                  Idioma
                  <InfoTooltip
                    title="Idioma del navegador"
                    body="El primer idioma configurado en el navegador del visitante. Sirve para saber de qué país viene aunque la IP esté en otro lado (VPN, viaje, etc.)."
                    example="es-AR = español argentino · en-US = inglés EEUU · pt-BR = portugués Brasil · es-ES = español España."
                    align="left"
                  />
                </th>
                <th style={headStyle}>
                  Dispositivo
                  <InfoTooltip
                    title="Tipo de dispositivo y navegador"
                    body="Detectado a partir del User Agent. La sigla de 8 caracteres es el inicio del ID único de cookie — útil para saber si dos escaneos vienen del mismo navegador. Pasá el mouse para ver el ID completo."
                    example="iPhone · Safari · a3f7b9c2 = un iPhone usando Safari. Si volvés a ver a3f7b9c2 en otra fila = misma persona escaneó de nuevo."
                    align="left"
                  />
                </th>
                <th style={headStyle}>
                  User Agent
                  <InfoTooltip
                    title="User Agent completo"
                    body="Texto técnico que el navegador envía con cada request. Identifica versión exacta del SO, modelo del dispositivo (a veces) y navegador. Útil para debug. La columna lo trunca a 80 caracteres; pasá el mouse para verlo completo."
                    example="Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1 = iPhone con iOS 18.2 usando Safari 18.2."
                    align="right"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const ua = scan.user_agent || ''
                const { device, browser } = parseUserAgent(ua)
                const uaTruncated = ua.length > 80 ? ua.substring(0, 80) + '…' : ua
                const deviceShort = scan.device_cookie_id ? scan.device_cookie_id.substring(0, 8) : 'N/A'

                const locationParts = [scan.city, scan.region, scan.country].filter(Boolean)
                const locationLabel = locationParts.join(', ') || 'Desconocido'
                const mapsUrl =
                  scan.latitude && scan.longitude
                    ? `https://www.google.com/maps?q=${scan.latitude},${scan.longitude}&z=11`
                    : null

                const cardLabel = nameByCard.get(scan.card_id)

                return (
                  <tr key={scan.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.05)' }}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <NfcLocalTime iso={scan.created_at} />
                    </td>
                    <td style={cellStyle}>
                      <span
                        title={cardLabel ? `Código físico: ${scan.card_id}` : undefined}
                        style={{
                          background: '#ff8a3d',
                          color: '#14120E',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {cardLabel ?? scan.card_id}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span>{locationLabel}</span>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir en Google Maps (ubicación aproximada por IP)"
                          style={{
                            color: '#ff8a3d',
                            textDecoration: 'none',
                            marginLeft: '0.5rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          📍
                        </a>
                      )}
                    </td>
                    <td style={cellStyle}>{scan.browser_language || '—'}</td>
                    <td style={cellStyle} title={scan.device_cookie_id || ''}>
                      <span style={{ display: 'block', fontWeight: 600 }}>
                        {device} · {browser}
                      </span>
                      <code style={{ opacity: 0.55, fontSize: '0.7rem' }}>{deviceShort}</code>
                    </td>
                    <td style={cellStyle} title={ua}>
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