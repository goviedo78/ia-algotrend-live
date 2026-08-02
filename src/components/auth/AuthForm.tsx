'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './auth.module.css'

const PENDING_OTP_STORAGE_KEY = 'gonovi.auth.pending-otp'
const PENDING_OTP_TTL_MS = 60 * 60 * 1000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type OtpResponseBody = {
  delivery?: unknown
  message?: unknown
}

async function readResponseBody(response: Response): Promise<OtpResponseBody | null> {
  const body = await response.json().catch(() => null)
  return body && typeof body === 'object' ? body as OtpResponseBody : null
}

function getErrorMessage(body: OtpResponseBody | null, fallback: string): string {
  return body && typeof body.message === 'string' ? body.message : fallback
}

function savePendingOtp(email: string, sentAt: number) {
  try {
    sessionStorage.setItem(PENDING_OTP_STORAGE_KEY, JSON.stringify({ email, sentAt }))
  } catch {
    // Storage can be unavailable in private browsing; the in-memory flow still works.
  }
}

function clearPendingOtp() {
  try {
    sessionStorage.removeItem(PENDING_OTP_STORAGE_KEY)
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export function AuthForm({ nextPath = '/account' }: { nextPath?: string }) {
  const router = useRouter()
  const otpRequestInFlight = useRef(false)
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentAt, setSentAt] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const restorePendingOtp = window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem(PENDING_OTP_STORAGE_KEY)
        if (!stored) return

        const pending = JSON.parse(stored) as { email?: unknown; sentAt?: unknown }
        const now = Date.now()
        if (
          typeof pending.email !== 'string'
          || !EMAIL_REGEX.test(pending.email)
          || typeof pending.sentAt !== 'number'
          || !Number.isFinite(pending.sentAt)
          || pending.sentAt > now + 60_000
          || now - pending.sentAt > PENDING_OTP_TTL_MS
        ) {
          clearPendingOtp()
          return
        }

        setEmail(pending.email)
        setStep('code')
        setSentAt(pending.sentAt)
        setTimeLeft(Math.max(0, 60 - Math.floor((now - pending.sentAt) / 1000)))
      } catch {
        clearPendingOtp()
      }
    }, 0)

    return () => window.clearTimeout(restorePendingOtp)
  }, [])

  useEffect(() => {
    if (sentAt === 0) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, 60 - Math.floor((Date.now() - sentAt) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [sentAt])

  const maskEmail = (str: string) => {
    const parts = str.split('@')
    if (parts.length !== 2) return str
    const name = parts[0]
    if (name.length <= 2) return str
    return `${name[0]}***@${parts[1]}`
  }

  const requestOtp = async (requestedEmail: string, fallbackError: string) => {
    if (otpRequestInFlight.current) return

    otpRequestInFlight.current = true
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: requestedEmail }),
      })
      const body = await readResponseBody(res)

      if (!res.ok) {
        setError(getErrorMessage(body, fallbackError))
        return
      }

      if (body?.delivery !== 'sent') {
        setError(fallbackError)
        return
      }

      const requestedAt = Date.now()
      setEmail(requestedEmail)
      setStep('code')
      setSentAt(requestedAt)
      setTimeLeft(60)
      savePendingOtp(requestedEmail, requestedAt)
    } catch {
      setError(fallbackError)
    } finally {
      otpRequestInFlight.current = false
      setLoading(false)
    }
  }

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    if (formData.get('_hp')) return

    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Email inválido.')
      return
    }

    await requestOtp(normalizedEmail, 'No se pudo enviar. Intentá de nuevo.')
  }

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const codeRegex = /^\d{6}$/
    if (!codeRegex.test(code)) {
      setError('El código debe tener 6 dígitos.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const body = await readResponseBody(res)
      if (res.ok) {
        clearPendingOtp()
        router.replace(nextPath)
        router.refresh()
      } else {
        setError(getErrorMessage(body, 'Código incorrecto'))
      }
    } catch {
      setError('Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timeLeft > 0) return
    await requestOtp(email, 'No se pudo reenviar el código.')
  }

  const handleChangeEmail = () => {
    clearPendingOtp()
    setStep('email')
    setCode('')
    setError('')
    setSentAt(0)
    setTimeLeft(0)
  }

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <div className={styles.cardGlow} aria-hidden="true" />
        <h1 className={styles.title}>{step === 'email' ? 'Bienvenido a GONOVI' : 'Ingresa tu código'}</h1>
        <p className={styles.description}>
          {step === 'email' 
            ? 'Ingresa tu email para recibir un código de acceso único. Sin contraseñas.' 
            : `Te enviamos un código a ${maskEmail(email)}`}
        </p>

        <form className={styles.form} onSubmit={step === 'email' ? handleRequestOtp : handleVerifyCode}>
          <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />

          {step === 'email' ? (
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input 
                id="email"
                type="email" 
                name="email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="send"
                maxLength={254} 
                required 
                placeholder="tu@email.com" 
                className={styles.input}
              />
            </div>
          ) : (
            <div className={styles.fieldGroup}>
              <label htmlFor="code" className={styles.label}>Código de 6 dígitos</label>
              <input 
                id="code"
                type="text" 
                name="code"
                inputMode="numeric" 
                autoComplete="one-time-code"
                enterKeyHint="done"
                pattern="\d{6}" 
                maxLength={6} 
                required 
                autoFocus
                placeholder="123456" 
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={styles.input}
                style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }}
              />
            </div>
          )}

          {error && <div className={styles.error} role="alert">{error}</div>}

          <button type="submit" disabled={loading} aria-busy={loading} className={styles.submitBtn}>
            {loading ? 'Procesando...' : (step === 'email' ? 'Enviar código' : 'Verificar')}
          </button>

          {step === 'code' && (
            <>
              <button type="button" onClick={handleResend} disabled={timeLeft > 0 || loading} className={styles.resendBtn}>
                Reenviar código {timeLeft > 0 ? `(${timeLeft}s)` : ''}
              </button>
              <button type="button" onClick={handleChangeEmail} disabled={loading} className={styles.resendBtn}>
                Usar otro correo
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
