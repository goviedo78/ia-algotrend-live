import type { Metadata } from 'next'
import Link from 'next/link'
import { loadLinksConfig } from '@/lib/links-config'
import { LinksAdmin } from '@/components/official/links-admin/LinksAdmin'
import { LinksAnalytics } from '@/components/official/links-analytics/LinksAnalytics'

export const metadata: Metadata = {
  title: 'Editor de /links | GONOVI',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type Tab = 'editor' | 'analytics'

interface Props {
  searchParams: Promise<{ pin?: string; tab?: string }>
}

const VALID_PIN = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD

export default async function Page({ searchParams }: Props) {
  const { pin, tab: tabRaw } = await searchParams
  const tab: Tab = tabRaw === 'analytics' ? 'analytics' : 'editor'

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

  const tabBar = (
    <nav
      style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.85rem 1.25rem 0',
        background: 'var(--background)',
        borderBottom: '1px solid rgba(229,212,182,0.08)',
      }}
    >
      <TabLink
        active={tab === 'editor'}
        href={`/official/links?pin=${encodeURIComponent(pin)}`}
        label="✏ Editor"
      />
      <TabLink
        active={tab === 'analytics'}
        href={`/official/links?pin=${encodeURIComponent(pin)}&tab=analytics`}
        label="📊 Analytics"
      />
    </nav>
  )

  if (tab === 'analytics') {
    return (
      <>
        {tabBar}
        <LinksAnalytics pin={pin ?? ''} />
      </>
    )
  }

  const config = await loadLinksConfig()
  return (
    <>
      {tabBar}
      <LinksAdmin pin={pin ?? ''} initialConfig={config} />
    </>
  )
}

function TabLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: '0.55rem 1rem',
        borderRadius: '8px 8px 0 0',
        fontSize: '0.82rem',
        letterSpacing: '0.04em',
        textDecoration: 'none',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        background: active ? 'rgba(244,78,28,0.16)' : 'transparent',
        color: active ? '#ffb38a' : 'rgba(229,212,182,0.55)',
        border: '1px solid',
        borderColor: active ? 'rgba(244,78,28,0.4)' : 'rgba(229,212,182,0.08)',
        borderBottomColor: active ? 'var(--background)' : 'transparent',
        marginBottom: '-1px',
      }}
    >
      {label}
    </Link>
  )
}
