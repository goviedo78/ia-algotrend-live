import type { Metadata } from 'next'
import Link from 'next/link'
import s from './practica.module.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Centro de Entrenamiento | GONOVI',
  description: 'Mejora tu toma de decisiones con el Trading Lab, Backtesting libre y Retos Interactivos. Simuladores diseñados para entrenar tu ojo clínico.',
  alternates: {
    canonical: 'https://gonovi.app/official/practica',
  },
}

export default function PracticaLobby() {
  return (
    <main className={s.shell}>
      <div className={s.noise} />
      
      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← Volver a GONOVI</Link>
        <div className={s.headerCenter}>
          <span className={s.headerLabel}>PRÁCTICA</span>
          <p className={s.headerSub}>Centro de Entrenamiento</p>
        </div>
        <div style={{ width: '4rem' }} />
      </header>

      <section className={s.grid}>
        <Link href="/official/lab" className={s.card}>
          <div className={s.cardHeader}>
            <span className={s.cardNum}>01</span>
            <span className={s.cardBadge}>Estático</span>
          </div>
          <h2 className={s.cardTitle}>Trading Lab</h2>
          <p className={s.cardDesc}>
            Analiza más de 40 escenarios reales de mercado. Evalúa el contexto, 
            identifica patrones institucionales y decide: Long, Short o Skip. 
            Resultados instantáneos con ratio R:R.
          </p>
        </Link>

        <Link href="/official/backtesting" className={s.card}>
          <div className={s.cardHeader}>
            <span className={s.cardNum}>02</span>
            <span className={s.cardBadge}>Dinámico</span>
          </div>
          <h2 className={s.cardTitle}>Backtesting Libre</h2>
          <p className={s.cardDesc}>
            Reproducción interactiva vela a vela. Simula operaciones en tiempo 
            real ajustando Entrada, Stop Loss y Take Profit sobre un motor de 
            gráficos SVG optimizado.
          </p>
        </Link>

        <Link href="/official/academia" className={s.card}>
          <div className={s.cardHeader}>
            <span className={s.cardNum}>03</span>
            <span className={s.cardBadge}>Evaluación</span>
          </div>
          <h2 className={s.cardTitle}>Trading Interactivo</h2>
          <p className={s.cardDesc}>
            Pon a prueba tu conocimiento bajo presión. Retos gamificados, 
            evaluación de setups complejos y scoring basado en la calidad 
            de tu toma de decisiones.
          </p>
        </Link>
      </section>

      <footer className={s.footer}>
        <span>GONOVI · CENTRO DE ENTRENAMIENTO</span>
      </footer>
    </main>
  )
}
