'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './auth.module.css'

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body && typeof body.message === 'string' ? body.message : fallback
}

export function AuthForm({ nextPath = '/account' }: { nextPath?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentAt, setSentAt] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState(0)

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

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    
    const formData = new FormData(e.currentTarget)
    if (formData.get('_hp')) return // Honeypot trap

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Email inválido.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStep('code')
        setSentAt(Date.now())
        setTimeLeft(60)
      } else {
        setError(await getErrorMessage(res, 'No se pudo enviar. Intentá de nuevo.'))
      }
    } catch {
      setError('No se pudo enviar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
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
      if (res.ok) {
        router.replace(nextPath)
        router.refresh()
      } else {
        setError('Código incorrecto')
      }
    } catch {
      setError('Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (timeLeft > 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSentAt(Date.now())
        setTimeLeft(60)
      } else {
        setError(await getErrorMessage(res, 'No se pudo reenviar el código.'))
      }
    } catch {
      setError('No se pudo reenviar el código.')
    } finally {
      setLoading(false)
    }
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
          <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

          {step === 'email' ? (
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input 
                id="email"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
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
                inputMode="numeric" 
                pattern="\d{6}" 
                maxLength={6} 
                required 
                placeholder="123456" 
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={styles.input}
                style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }}
              />
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Procesando...' : (step === 'email' ? 'Enviar código' : 'Verificar')}
          </button>

          {step === 'code' && (
            <button type="button" onClick={handleResend} disabled={timeLeft > 0 || loading} className={styles.resendBtn}>
              Reenviar código {timeLeft > 0 ? `(${timeLeft}s)` : ''}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
