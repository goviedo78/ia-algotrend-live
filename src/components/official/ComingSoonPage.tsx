import styles from './coming-soon.module.css'

export function ComingSoonPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.mark} aria-hidden="true">
          <div className={styles.markAura} />
          <div className={styles.markBreath} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.markLogo} src="/logo-gon-mark-3d.svg" alt="" />
        </div>

        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          <span>GONOVI · Hub personal</span>
        </div>

        <h1>Próximamente</h1>
        <p className={styles.sub}>Nueva experiencia en camino</p>
        <div className={styles.rule} />
        <p className={styles.desc}>
          El hub personal de GONOVI está siendo preparado con cuidado. Los productos del ecosistema siguen activos sin interrupciones.
        </p>

        <a className={styles.badge} href="https://oro15.gonovi.app" target="_blank" rel="noreferrer">
          <span className={styles.liveDot} aria-label="En línea" />
          Oro 15M en vivo · oro15.gonovi.app
        </a>
      </div>

      <footer className={styles.footer}>GONOVI © 2026</footer>
    </main>
  )
}
