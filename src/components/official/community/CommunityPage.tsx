import Link from 'next/link'
import styles from './community.module.css'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

export function CommunityPage() {
  return (
    <main className={styles.container}>
      <Link href="/official" className={styles.backLink}>← Volver a GONOVI</Link>
      <header className={styles.header}>
        <div className={styles.kickerWrapper}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <p className={styles.kicker}>Ecosistema</p>
        </div>
        <h1 className={styles.title}>Nuestra Comunidad</h1>
        <p className={styles.description}>
          Canales oficiales del ecosistema GONOVI para aprender, resolver dudas y recibir nuevos indicadores.
        </p>
      </header>

      <section className={styles.panelGrid}>
        <a 
          href="https://wa.me/message/JLQM6YKXFPKHP1" 
          target="_blank" 
          rel="noreferrer" 
          className={styles.panel}
        >
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.panelContent}>
            <div className={styles.iconWrapper}>
              <WhatsAppIcon />
            </div>
            <h2 className={styles.panelTitle}>Grupo de WhatsApp</h2>
            <p className={styles.panelDesc}>
              El canal principal para anuncios rápidos, lanzamientos de nuevas herramientas 
              y recordatorios de sesiones o actualizaciones.
            </p>
            <ul className={styles.features}>
              <li>Alertas tempranas de nuevos indicadores</li>
              <li>Avisos de actualizaciones técnicas</li>
              <li>Comunicación directa de anuncios</li>
            </ul>
            <span className={styles.actionText}>Unirse al grupo →</span>
          </div>
        </a>

        <a 
          href="https://youtube.com/@gonovi" 
          target="_blank" 
          rel="noreferrer" 
          className={styles.panel}
        >
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.panelContent}>
            <div className={styles.iconWrapper}>
              <YouTubeIcon />
            </div>
            <h2 className={styles.panelTitle}>Canal de YouTube</h2>
            <p className={styles.panelDesc}>
              Tutoriales, guías paso a paso, backtesting de estrategias y análisis de mercado 
              utilizando el ecosistema de herramientas GONOVI.
            </p>
            <ul className={styles.features}>
              <li>Video tutoriales de cada indicador</li>
              <li>Conceptos de Smart Money (SMC) y Acción de Precio</li>
              <li>Repaso de operativas y sesiones reales</li>
            </ul>
            <span className={styles.actionText}>Suscribirse al canal →</span>
          </div>
        </a>
      </section>
    </main>
  )
}
