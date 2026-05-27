import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { InfoTooltip } from '@/components/official/InfoTooltip'
import { NfcLocalTime } from '@/components/official/analytics/NfcLocalTime'
import { CardNameForm } from '@/components/official/analytics/CardNameForm'
import { RefreshButton } from '@/components/official/analytics/RefreshButton'
import { CardFilter } from '@/components/official/analytics/CardFilter'
import { InstallPWA } from '@/components/official/analytics/InstallPWA'
import s from './nfc.module.css'

export const metadata: Metadata = {
  title: 'NFC Analytics | GONOVI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ pin?: string; card?: string }>
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

function parseUserAgent(ua: string | null): { device: string; browser: string; system: string; summary: string } {
  if (!ua) return { device: '—', browser: '—', system: '—', summary: 'Sin datos' }
  let device = 'PC'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Macintosh/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Linux/i.test(ua)) device = 'Linux'

  let browser = 'Otro'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'

  let system = 'Sistema no detectado'
  const iosMatch = ua.match(/OS ([\d_]+)/i)
  const androidMatch = ua.match(/Android\s+([\d.]+)/i)
  const macMatch = ua.match(/Mac OS X ([\d_]+)/i)
  const windowsMatch = ua.match(/Windows NT ([\d.]+)/i)

  if ((device === 'iPhone' || device === 'iPad') && iosMatch) {
    system = `iOS ${iosMatch[1].replaceAll('_', '.').split('.').slice(0, 2).join('.')}`
  } else if (androidMatch) {
    system = `Android ${androidMatch[1].split('.').slice(0, 2).join('.')}`
  } else if (macMatch) {
    system = `macOS ${macMatch[1].replaceAll('_', '.').split('.').slice(0, 2).join('.')}`
  } else if (windowsMatch) {
    system = windowsMatch[1] === '10.0' ? 'Windows 10/11' : `Windows ${windowsMatch[1]}`
  } else if (/Linux/i.test(ua)) {
    system = 'Linux'
  }

  return { device, browser, system, summary: `${device} · ${browser} · ${system}` }
}

export default async function NfcAnalyticsPage({ searchParams }: Props) {
  const { pin, card } = await searchParams

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

  let query = supabase.from('nfc_analytics').select('*').order('created_at', { ascending: false }).limit(500)
  if (card) {
    query = query.eq('card_id', card)
  }

  const [scansRes, namesRes] = await Promise.all([
    query,
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

  return (
    <main className={s.main}>
      <header className={s.header}>
        <div>
          <h1 className={s.headerTitle}>NFC Analytics</h1>
          <p className={s.headerSubtitle}>Últimos 500 escaneos · hora local de tu navegador</p>
        </div>
        <div className={s.headerControls} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <InstallPWA />
          <CardFilter
            pin={pin ?? ''}
            cards={names.map(n => ({ id: n.card_id, label: `${n.name} (${n.card_id})` }))}
          />
          <RefreshButton />
          <Link
            href={`/official/analytics?pin=${pin}`}
            style={{
              color: '#E5D4B6',
              textDecoration: 'none',
              border: '1px solid rgba(79, 85, 112, 0.6)',
              background: 'rgba(28, 34, 58, 0.4)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
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

      <section className={s.statsSection}>
        <div className={s.statCard}>
          <div className={s.statLabel}>Total Escaneos</div>
          <div className={s.statValue}>{totalScans}</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>
            Dispositivos Únicos
            <InfoTooltip
              title="Dispositivos únicos"
              body="Cada navegador recibe una cookie con un identificador al primer escaneo. Si la misma persona escanea 5 veces con su teléfono, suma 1 dispositivo. Si cambia de teléfono o borra cookies, cuenta como nuevo."
              example="3 escaneos del mismo iPhone = 1 dispositivo único. 3 escaneos desde 3 teléfonos distintos = 3 dispositivos únicos."
              align="left"
            />
          </div>
          <div className={s.statValue}>{uniqueDevices}</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statLabel}>Top Tarjetas Físicas</div>
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
        <div className={s.tableWrapper}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>
                  Fecha
                  <InfoTooltip
                    title="Fecha y hora del escaneo"
                    body="Convertida a la hora local de tu navegador automáticamente. Pasá el mouse sobre el valor para ver la hora UTC original (la que está guardada en la base)."
                    example="Si escanean a las 20:15 hora Argentina y vos abrís el dashboard desde Madrid, ves '01:15' (hora Madrid)."
                    align="left"
                  />
                </th>
                <th className={s.th}>
                  Tarjeta Física (ID)
                  <InfoTooltip
                    title="ID Físico de la Tarjeta"
                    body="Es el identificador grabado en el chip NFC de la tarjeta real (ej. b1, vip7). Corresponde a la ruta corta en la URL (gonovi.app/x/b1). Si le asignaste un nombre arriba, ves el nombre en lugar del código. Pasá el mouse para ver el código físico original."
                    example="Grabaste la URL /x/b1 en tu tarjeta negra. Al escanearla, aquí aparecerá 'b1'."
                    align="left"
                  />
                </th>
                <th className={s.th}>
                  Ubicación
                  <InfoTooltip
                    title="Ubicación aproximada por IP"
                    body="Vercel detecta país, ciudad y región según la IP. Precisión típica: 10-50 km en zonas urbanas, peor en zonas rurales. NO es la calle exacta — para eso habría que pedir permiso GPS al visitante (rompe lo discreto del NFC). Hacé clic en el pin 📍 para abrir Google Maps con la lat/lon aproximada."
                    example="Buenos Aires, AR (Argentina) — radio ~15 km. El pin te lleva al barrio aproximado, no a la calle."
                    align="left"
                  />
                </th>
                <th className={`${s.th} ${s.hideMobile}`}>
                  Idioma
                  <InfoTooltip
                    title="Idioma del navegador"
                    body="El primer idioma configurado en el navegador del visitante. Sirve para saber de qué país viene aunque la IP esté en otro lado (VPN, viaje, etc.)."
                    example="es-AR = español argentino · en-US = inglés EEUU · pt-BR = portugués Brasil · es-ES = español España."
                    align="left"
                  />
                </th>
                <th className={`${s.th} ${s.hideMobile}`}>
                  Dispositivo
                  <InfoTooltip
                    title="Tipo de dispositivo y navegador"
                    body="Detectado a partir del User Agent. La sigla de 8 caracteres es el inicio del ID único de cookie — útil para saber si dos escaneos vienen del mismo navegador. Pasá el mouse para ver el ID completo."
                    example="iPhone · Safari · a3f7b9c2 = un iPhone usando Safari. Si volvés a ver a3f7b9c2 en otra fila = misma persona escaneó de nuevo."
                    align="left"
                  />
                </th>
                <th className={s.th}>
                  Resumen técnico
                  <InfoTooltip
                    title="Resumen técnico"
                    body="Versión corta del dispositivo, navegador y sistema. El texto completo queda oculto y solo aparece como ayuda técnica al pasar el mouse."
                    example="iPhone · Safari · iOS 18.2"
                    align="right"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const ua = scan.user_agent || ''
                const { device, browser, system, summary } = parseUserAgent(ua)
                const deviceShort = scan.device_cookie_id ? scan.device_cookie_id.substring(0, 8) : 'N/A'

                const locationParts = [scan.city, scan.region, scan.country]
                  .filter(Boolean)
                  .map(part => {
                    try { return decodeURIComponent(part as string) }
                    catch { return part }
                  })
                const locationLabel = locationParts.join(', ') || 'Desconocido'
                const mapsUrl =
                  scan.latitude && scan.longitude
                    ? `https://www.google.com/maps?q=${scan.latitude},${scan.longitude}&z=11`
                    : null

                const cardLabel = nameByCard.get(scan.card_id)

                return (
                  <tr key={scan.id} className={s.row}>
                    <td data-label="Fecha" style={{ whiteSpace: 'nowrap' }} className={s.td}>
                      <NfcLocalTime iso={scan.created_at} />
                    </td>
                    <td data-label="Tarjeta" className={s.td}>
                      <span
                        title={cardLabel ? `Código físico: ${scan.card_id}` : undefined}
                        className={s.cardBadge}
                      >
                        {cardLabel ?? scan.card_id}
                      </span>
                    </td>
                    <td data-label="Ubicación" className={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                      </div>
                    </td>
                    <td data-label="Idioma" className={`${s.td} ${s.hideMobile}`}>{scan.browser_language || '—'}</td>
                    <td data-label="Dispositivo" className={`${s.td} ${s.hideMobile}`} title={scan.device_cookie_id || ''}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>
                          {device} · {browser}
                        </span>
                        <code style={{ opacity: 0.55, fontSize: '0.7rem' }}>{deviceShort}</code>
                      </div>
                    </td>
                    <td data-label="Resumen" className={s.td} title={ua || undefined}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>{summary}</span>
                        <span style={{ display: 'block', opacity: 0.5, fontSize: '0.68rem', marginTop: '0.15rem' }}>
                          {system === '—' ? 'sin detalle técnico' : 'detalle al pasar mouse'}
                        </span>
                      </div>
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
