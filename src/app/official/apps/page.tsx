import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import styles from './apps.module.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'GONOVI · Apps',
  description: 'Aplicaciones e indicadores del ecosistema GONOVI: Materia, Auditoría Montecarlo, Trading Lab, Resultados en vivo y más.',
  alternates: { canonical: 'https://gonovi.app/official/apps' },
  openGraph: {
    title: 'GONOVI · Apps',
    description: 'Apps e indicadores del ecosistema GONOVI.',
    url: 'https://gonovi.app/official/apps',
    siteName: 'GONOVI',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
    type: 'website',
  },
}

export const dynamic = 'force-dynamic'

const apps = [
  { num: '01', title: 'Materia (Inicio)', text: 'Hub principal con el ecosistema completo.', href: '/official' },
  { num: '02', title: 'Resultados en vivo', text: 'BTC 1H, Oro 15M y Oro 30M en tiempo real.', href: '/official/estrategias' },
  { num: '03', title: 'Centro de Entrenamiento', text: 'Trading Lab, backtesting vela a vela y retos.', href: '/official/practica' },
  { num: '04', title: 'Auditoría Montecarlo', text: 'Stress test, drawdown extremo y probabilidad de ruina.', href: '/official/montecarlo' },
  { num: '05', title: 'Videos y Tutoriales', text: 'Análisis, setups y masterclasses.', href: '/official/videos' },
  { num: '06', title: 'Obtener Script', text: 'Pine Script completo, entrega inmediata.', href: '/official/store' },
  { num: '07', title: 'Soporte', text: 'Asistencia con tu cuenta y suscripción.', href: '/official/soporte' },
  { num: '08', title: 'Links', text: 'Hub de enlaces personalizado de GONOVI.', href: '/links' },
]

export default function AppsPage() {
  if (process.env.OFFICIAL_ENABLED !== 'true') notFound()

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.back} href="/official">← Volver</Link>
        <h1>Apps del ecosistema</h1>
        <p>Todo lo que vive dentro de GONOVI.</p>
      </header>

      <nav className={styles.grid} aria-label="Aplicaciones GONOVI">
        {apps.map((app) => (
          <Link key={app.href} href={app.href} className={styles.card}>
            <span className={styles.num}>{app.num}</span>
            <strong>{app.title}</strong>
            <p>{app.text}</p>
            <span className={styles.cta}>Abrir →</span>
          </Link>
        ))}
      </nav>
    </main>
  )
}
