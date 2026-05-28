import type { Metadata } from 'next'
import Link from 'next/link'
import { loadLinksConfig } from '@/lib/links-config'
import { LinksAdmin } from '@/components/official/links-admin/LinksAdmin'

export const metadata: Metadata = {
  title: 'Editor de /links | GONOVI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ pin?: string }>
}

const VALID_PIN = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD

export default async function Page({ searchParams }: Props) {
  const { pin } = await searchParams

  if (!VALID_PIN || pin !== VALID_PIN) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--background)',
          color: 'rgba(229,212,182,0.6)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.78rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: '1rem' }}>
          <p>Editor /links — se requiere PIN</p>
          <p style={{ color: 'rgba(229,212,182,0.32)', fontSize: '0.64rem' }}>
            Agregar <code>?pin=TU_PIN</code> a la URL
          </p>
          <Link href="/official" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            ← Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  const config = await loadLinksConfig()
  return <LinksAdmin pin={pin ?? ''} initialConfig={config} />
}
