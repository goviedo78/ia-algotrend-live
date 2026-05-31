import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { InfoTooltip } from '@/components/official/InfoTooltip'
import { CardNameForm } from '@/components/official/analytics/CardNameForm'
import { RefreshButton } from '@/components/official/analytics/RefreshButton'
import { CardFilter } from '@/components/official/analytics/CardFilter'
import { InstallPWA } from '@/components/official/analytics/InstallPWA'
import { NfcScanTable } from '@/components/official/analytics/NfcScanTable'
import s from './nfc.module.css'

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { pin } = await searchParams
  return {
    title: 'NFC Analytics | GONOVI',
    robots: { index: false, follow: false },
    manifest: `/api/manifest-nfc?pin=${pin || ''}`,
    icons: {
      // Cache-busting query string: Safari/iOS cachean el apple-touch-icon
      // muy agresivamente; al cambiar el query se fuerza re-descarga.
      icon: [
        { url: '/icons/nfc-icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/nfc-icon-180.png?v=3', sizes: '180x180', type: 'image/png' },
      ],
    },
    appleWebApp: {
      title: 'NFC Admin',
      statusBarStyle: 'black-translucent',
      capable: true
    }
  }
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
  
  const nameByCardRecord: Record<string, string> = {}
  names.forEach(n => {
    nameByCardRecord[n.card_id] = n.name
  })

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
                  <span style={{ fontWeight: 700 }}>{nameByCardRecord[id] ?? id}</span>{' '}
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
        <NfcScanTable scans={scans} nameByCard={nameByCardRecord} pin={pin ?? ''} />
      )}

      {/* Floating Logo GONOVI */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'rgba(28, 34, 58, 0.4)',
        backdropFilter: 'blur(24px) saturate(120%)',
        WebkitBackdropFilter: 'blur(24px) saturate(120%)',
        border: '1px solid rgba(229, 212, 182, 0.1)',
        borderTop: '1px solid rgba(229, 212, 182, 0.25)',
        borderLeft: '1px solid rgba(229, 212, 182, 0.15)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        pointerEvents: 'none'
      }}>
        <img 
          src="/logo-orange-graphite-navy/01-navy-cream-orange-transparent.svg" 
          alt="GONOVI" 
          style={{ width: '28px', height: '28px', opacity: 0.95, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} 
        />
      </div>
    </main>
  )
}
