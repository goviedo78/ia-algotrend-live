'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import shellStyles from '../official-home.module.css'
import { createClient } from '@/lib/supabase/client'
import styles from './soporte.module.css'

const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export function SoportePage() {
  const pathname = usePathname()
  const [nyTime, setNyTime] = useState('')
  const [btcChange, setBtcChange] = useState<{ pct: string; up: boolean } | null>(null)

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '', _gotcha: '' })

  useEffect(() => {
    const tick = () => setNyTime(nyFormatter.format(new Date()))
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetchBtc = () =>
      fetch('https://www.bitstamp.net/api/v2/ticker/btcusd/')
        .then((r) => r.json())
        .then((d) => {
          const pct = ((parseFloat(d.last) - parseFloat(d.open)) / parseFloat(d.open)) * 100
          setBtcChange({ pct: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', up: pct >= 0 })
        })
        .catch(() => { /* silent */ })
    fetchBtc()
    const id = setInterval(fetchBtc, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email
      if (userEmail) {
        setFormData(prev => prev.email === '' ? { ...prev, email: userEmail } : prev)
      }
    }).catch(() => { /* silent */ })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.subject || !formData.message) return

    setStatus('sending')
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setStatus('sent')
        setFormData({ name: '', email: '', subject: '', message: '', _gotcha: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <section className={shellStyles.appFrame} aria-label="GONOVI Soporte">
        
        {/* APP SHELL HEADER */}
        <header className={shellStyles.topbar}>
          <div className={shellStyles.brand}>
            <span className={shellStyles.brandDot} aria-hidden="true" />
            GONOVI
            <span className={shellStyles.brandVersion}>INICIO</span>
          </div>
          <nav className={shellStyles.topnav} aria-label="Navegación principal">
            <Link href="/official" className={pathname === '/official' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official' ? 'page' : undefined}>Inicio</Link>
            <Link href="/official/montecarlo" className={pathname === '/official/montecarlo' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/montecarlo' ? 'page' : undefined}>Auditoría</Link>
            <Link href="/official/estrategias" className={pathname === '/official/estrategias' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/estrategias' ? 'page' : undefined}>Resultados</Link>
            <Link href="/official/soporte" className={pathname === '/official/soporte' ? shellStyles.topnavActive : ''} aria-current={pathname === '/official/soporte' ? 'page' : undefined}>Soporte</Link>
          </nav>
          <div className={shellStyles.session}>
            <span className={shellStyles.sessionLive}>
              <span className={shellStyles.pulse} aria-label="Sesión activa" />
              Sesión activa
            </span>
            <span>NY · {nyTime || '––:––'}</span>
            <span className={shellStyles.sessionId}>Trader · 0427</span>
          </div>
        </header>

        {/* CONTENT */}
        <div className={styles.container}>
          <Link href="/official" className={styles.backLink}>← Volver a GONOVI</Link>
          <div>
            <h1 className={styles.title}>Soporte directo</h1>
            <p className={styles.description}>Contanos tu duda y te respondemos por email.</p>
          </div>

          <div className={styles.formCard}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <input type="text" name="_gotcha" value={formData._gotcha} onChange={handleChange} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
              
              <div className={styles.fieldGroup}>
                <label htmlFor="name" className={styles.label}>Nombre</label>
                <input required id="name" name="name" type="text" maxLength={100} value={formData.name} onChange={handleChange} className={styles.input} placeholder="Tu nombre" />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input required id="email" name="email" type="email" maxLength={150} value={formData.email} onChange={handleChange} className={styles.input} placeholder="tu@email.com" />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="subject" className={styles.label}>Asunto</label>
                <input required id="subject" name="subject" type="text" maxLength={200} value={formData.subject} onChange={handleChange} className={styles.input} placeholder="¿En qué te podemos ayudar?" />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="message" className={styles.label}>Mensaje</label>
                <textarea required id="message" name="message" maxLength={5000} value={formData.message} onChange={handleChange} className={styles.textarea} placeholder="Detalles de tu consulta..." />
              </div>

              <button type="submit" disabled={status === 'sending' || status === 'sent'} className={styles.submitBtn}>
                {status === 'sending' ? 'Enviando...' : status === 'sent' ? 'Enviado' : 'Enviar mensaje'}
              </button>

              {status === 'sent' && (
                <div className={`${styles.statusMessage} ${styles.statusSuccess}`}>
                  ¡Mensaje enviado con éxito! Te respondemos pronto.
                </div>
              )}
              {status === 'error' && (
                <div className={`${styles.statusMessage} ${styles.statusError}`}>
                  Ocurrió un error al enviar el mensaje. Por favor intenta más tarde.
                </div>
              )}
            </form>
          </div>
        </div>

        {/* APP SHELL FOOTER */}
        <footer className={shellStyles.bottombar}>
          <div className={shellStyles.ticker} aria-label="Precios de mercado">
            <div className={shellStyles.tickerTrack} aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className={shellStyles.tickerSet}>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>ES1!</span><span className={shellStyles.tickUp}>+0.42%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>NQ1!</span><span className={shellStyles.tickUp}>+0.71%</span></div>
                  <div className={shellStyles.tickItem}>
                    <span className={shellStyles.tickPair}>BTC</span>
                    {btcChange
                      ? <span className={btcChange.up ? shellStyles.tickUp : shellStyles.tickDown}>{btcChange.pct}</span>
                      : <span className={shellStyles.tickMuted}>···</span>}
                  </div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>EURUSD</span><span className={shellStyles.tickUp}>+0.08%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>XAU</span><span className={shellStyles.tickDown}>−0.22%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>GC1!</span><span className={shellStyles.tickUp}>+0.14%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>CL1!</span><span className={shellStyles.tickDown}>−0.33%</span></div>
                  <div className={shellStyles.tickItem}><span className={shellStyles.tickPair}>DXY</span><span className={shellStyles.tickDown}>−0.11%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className={shellStyles.bottomVer}>
            <span>© GONOVI 2026</span>
            <span className={shellStyles.bottomSecured}>SECURED · TLS 1.3</span>
          </div>
        </footer>
      </section>
    </main>
  )
}
