'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  installSteps,
  beforeBuyingItems,
  alertInfo,
  alertSteps,
  faqItems,
  type FaqItem,
} from '@/data/official/install-faq'
import s from './install-guide.module.css'

/* ── accordion item ── */
function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])

  return (
    <div className={`${s.faqItem} ${open ? s.faqOpen : ''}`}>
      <button type="button" className={s.faqQuestion} onClick={toggle} aria-expanded={open}>
        <span>{item.question}</span>
        <span className={s.faqChevron} aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className={s.faqAnswer}>
          <p>{item.answer}</p>
        </div>
      )}
    </div>
  )
}

/* ── main page ── */
export default function InstallGuidePage() {
  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <div className={s.shardOne} aria-hidden="true" />
      <div className={s.shardTwo} aria-hidden="true" />

      {/* ── header ── */}
      <header className={s.header}>
        <Link href="/official" className={s.backLink}>
          ← GONOVI
        </Link>
        <div className={s.headerCenter}>
          <span className={s.headerLabel}>GONOVI · SOPORTE TRADINGVIEW</span>
          <p className={s.headerSub}>Instalacion del Pine Script completo y alertas</p>
        </div>
        <div className={s.headerBadge}>Guia</div>
      </header>

      {/* ── hero ── */}
      <section className={s.hero}>
        <h1 className={s.heroTitle}>
          Como cargar tu Pine Script en TradingView
        </h1>
        <p className={s.heroLead}>
          Recibís el Pine Script completo por email. Lo cargás en TradingView, lo guardás y configurás alertas.
        </p>
        <div className={s.heroBadges}>
          <span className={s.badgeAccent}>script completo</span>
          <span className={s.badgeGhost}>tuyo para siempre</span>
          <span className={s.badgeGhost}>sin acceso revocable</span>
        </div>
      </section>

      {/* ── before buying ── */}
      <section className={s.contentSection}>
        <div className={s.sectionIntro}>
          <p className={s.kicker}>Antes de comprar</p>
          <h2 className={s.sectionTitle}>Lo que necesitas saber</h2>
          <p className={s.sectionLead}>
            Respuestas rapidas para que tomes la decision con toda la informacion.
          </p>
        </div>
        <div className={s.cardGrid}>
          {beforeBuyingItems.map((item) => (
            <article key={item.question} className={s.infoCard}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── install steps ── */}
      <section className={s.stepsSection}>
        <div className={s.sectionIntro}>
          <p className={s.kicker}>Instalacion</p>
          <h2 className={s.sectionTitle}>8 pasos para cargar el indicador en tu grafico</h2>
          <p className={s.sectionLead}>
            Desde la compra hasta ver la primera senal. Cada paso toma segundos.
          </p>
        </div>
        <div className={s.stepsGrid}>
          {installSteps.map((step) => (
            <div key={step.number} className={s.stepCard}>
              <span className={s.stepNumber}>{step.number}</span>
              <div>
                <strong className={s.stepTitle}>{step.title}</strong>
                <p className={s.stepDetail}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── alerts ── */}
      <section className={s.contentSection}>
        <div className={s.sectionIntro}>
          <p className={s.kicker}>Alertas</p>
          <h2 className={s.sectionTitle}>Recibe senales sin mirar el grafico</h2>
          <p className={s.sectionLead}>
            TradingView permite crear alertas que te avisan al celular, email o a un sistema externo
            cuando el indicador genera una senal.
          </p>
        </div>

        <div className={s.alertTypeGrid}>
          {alertInfo.map((info) => (
            <article key={info.title} className={s.alertTypeCard}>
              <h3>{info.title}</h3>
              <p>{info.detail}</p>
            </article>
          ))}
        </div>

        <div className={s.alertStepsBox}>
          <strong className={s.alertStepsTitle}>Como crear una alerta</strong>
          <ol className={s.alertStepsList}>
            {alertSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className={s.alertNote}>
            Los webhooks requieren plan Essential o superior de TradingView.
            Las alertas push y popup funcionan en cualquier plan.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={s.faqSection}>
        <div className={s.sectionIntro}>
          <p className={s.kicker}>Preguntas frecuentes</p>
          <h2 className={s.sectionTitle}>Dudas resueltas</h2>
        </div>
        <div className={s.faqList}>
          {faqItems.map((item) => (
            <FaqAccordion key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* ── disclaimer ── */}
      <section className={s.disclaimerBox}>
        <p>
          Los indicadores AlgoTrend son herramientas de analisis tecnico y educacion.
          No constituyen asesoria financiera, recomendacion de inversion ni garantia de resultados.
          Cada persona es responsable de sus propias decisiones de trading y gestion de riesgo.
        </p>
      </section>

      {/* ── CTA final ── */}
      <section className={s.ctaSection}>
        <h2 className={s.ctaTitle}>Siguiente paso</h2>
        <div className={s.ctaGrid}>
          <a className={s.ctaCard} href="https://wa.me/message/JLQM6YKXFPKHP1" target="_blank" rel="noreferrer">
            <span className={s.ctaCardKicker}>Ya compre</span>
            <strong>Necesito ayuda con mi script</strong>
            <p>Escribinos por WhatsApp con tu comprobante o captura del error en Pine Editor.</p>
          </a>
          <Link className={s.ctaCard} href="/official#demos">
            <span className={s.ctaCardKicker}>Quiero ver primero</span>
            <strong>Ver las demos en vivo</strong>
            <p>BTC 1H, Oro 15M y Oro 30M corriendo en tiempo real.</p>
          </Link>
          <Link className={s.ctaCard} href="/official">
            <span className={s.ctaCardKicker}>Volver</span>
            <strong>Ir al inicio de GONOVI</strong>
            <p>Indicadores, educación, comunidad y más.</p>
          </Link>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className={s.footer}>
        <span>GONOVI · SOPORTE TRADINGVIEW</span>
        <Link href="/official">Volver al inicio</Link>
      </footer>
    </main>
  )
}
