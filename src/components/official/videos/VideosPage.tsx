'use client'

import Link from 'next/link'
import styles from './videos.module.css'

type Video = {
  id: string
  title: string
}

const VIDEOS: Video[] = [
  { id: 'iSR208NkK-Q', title: 'Probé Opening Range 90 días: 58% win rate real' },
  { id: '8vxBFYemL7k', title: 'TradingView no quería que hiciera esto con los indicadores' },
  { id: 'QOSQX4-7-14', title: 'Creé un Perfil de Volumen GRATIS para TradingView' },
  { id: '7gxv30_C9vw', title: 'Indicador que Detecta LIQUIDEZ y Tendencias (FVG, BOS, CHoCH)' },
  { id: 'R1oAu_hRpeo', title: 'Creé un indicador 7 en 1… y descubrí este truco' },
  { id: 'wZPeVQ6LNqM', title: 'Probé a Chat GPT en BackTesting y ESTO PASÓ' },
  { id: 'IWRbNksnyvg', title: 'Repaso de TODOS MIS ERRORES de 2025 y ACIERTOS' },
  { id: 'eccPWdHf2pM', title: 'Michael Burry COMPRO algo MUY INTERESANTE' },
  { id: 'NaMUWIoDyJg', title: 'Cómo administro múltiples cuentas de Fiverr' },
  { id: 'tuScc5vyc5Q', title: 'Y lo USAMOS para crear una NUEVA CUENTA' }
]

export function VideosPage() {
  return (
    <main className={styles.container}>
      <Link href="/official" className={styles.backLink}>← Volver a GONOVI</Link>
      <header className={styles.header}>
        <div className={styles.kickerWrapper}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <p className={styles.kicker}>Canal de YouTube</p>
        </div>
        <h1 className={styles.title}>Videos Recientes</h1>
        <p className={styles.description}>
          Tutoriales, herramientas y operativas directamente de mi canal de YouTube.
        </p>
      </header>

      <div className={styles.videoGrid}>
        {VIDEOS.map((video) => (
          <article key={video.id} className={styles.videoCard}>
            <div className={styles.iframeWrapper}>
              <iframe
                className={styles.iframe}
                src={`https://www.youtube.com/embed/${video.id}?modestbranding=1&rel=0&color=white`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
            <div className={styles.videoInfo}>
              <h3 className={styles.videoTitle}>{video.title}</h3>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.footerActions}>
        <a
          href="https://www.youtube.com/@gonovi?sub_confirmation=1"
          className={styles.subscribeCta}
          target="_blank"
          rel="noopener noreferrer"
        >
          Suscribirse al canal →
        </a>
      </div>
    </main>
  )
}
