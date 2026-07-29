'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BrokerBrand } from './BrokerBrand'
import { BrokerThemeToggle, useBrokerTheme } from './BrokerThemeToggle'
import styles from './brokers.module.css'

type TotpFactor = { id: string; friendly_name?: string; status: string }

export function BrokerSecurityPanel({ email, nextPath }: { email: string; nextPath: string }) {
  const { theme, toggleTheme } = useBrokerTheme()
  const router = useRouter()
  const [factors, setFactors] = useState<TotpFactor[]>([])
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: aal }, { data, error: listError }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
    if (listError) setError('No se pudo cargar la configuración MFA.')
    const totp = (data?.totp ?? []) as TotpFactor[]
    setFactors(totp)
    if (aal?.currentLevel === 'aal2') router.replace(nextPath)
    setBusy(false)
  }, [nextPath, router])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function enroll() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'GONOVI Brokers',
    })
    if (enrollError || !data) {
      setError('No se pudo crear el segundo factor.')
    } else {
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    }
    setBusy(false)
  }

  async function verify(id: string) {
    if (!/^\d{6}$/.test(code)) {
      setError('Ingresá el código de 6 dígitos.')
      return
    }
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: id })
    if (challengeError || !challenge) {
      setError('No se pudo iniciar la verificación.')
      setBusy(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: id,
      challengeId: challenge.id,
      code,
    })
    if (verifyError) {
      setError('El código no es válido o ya venció.')
      setBusy(false)
      return
    }
    router.replace(nextPath)
    router.refresh()
  }

  const verified = factors.find((factor) => factor.status === 'verified')
  const activeFactor = factorId || verified?.id || ''

  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.topbar}>
        <BrokerBrand />
        <nav><BrokerThemeToggle theme={theme} onToggle={toggleTheme} /><span className={styles.identity}>{email}</span></nav>
      </header>
      <section className={styles.narrow}>
        <div className={styles.titleRow}>
          <ShieldCheck size={24} />
          <div><h1>Verificación en dos pasos</h1><p>Obligatoria para administrar credenciales de brokers.</p></div>
        </div>

        {busy && <div className={styles.notice}><LoaderCircle className={styles.spin} size={18} /> Verificando seguridad…</div>}
        {!busy && !verified && !factorId && (
          <div className={styles.section}>
            <div className={styles.sectionHeading}><KeyRound size={18} /><h2>Configurar autenticador</h2></div>
            <p>Usá una aplicación compatible con códigos TOTP.</p>
            <button className={styles.primaryButton} onClick={enroll}>Configurar <ArrowRight size={17} /></button>
          </div>
        )}
        {qrCode && (
          <div className={styles.section}>
            <h2>Escaneá el código</h2>
            <Image className={styles.qr} src={qrCode} width={220} height={220} unoptimized alt="Código QR para configurar MFA" />
            <label className={styles.field}><span>Clave manual</span><input readOnly value={secret} /></label>
          </div>
        )}
        {!busy && activeFactor && (
          <div className={styles.section}>
            <label className={styles.field}><span>Código de 6 dígitos</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label>
            <button className={styles.primaryButton} disabled={busy} onClick={() => verify(activeFactor)}>Verificar <ArrowRight size={17} /></button>
          </div>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
  )
}
