'use client'

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import styles from './brokers.module.css'

const PRIVACY_STORAGE_KEY = 'gonovi-broker-video-privacy'
const PRIVACY_EVENT = 'gonovi-broker-video-privacy-change'

function privacySnapshot() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PRIVACY_STORAGE_KEY) === '1'
}

function subscribePrivacy(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(PRIVACY_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PRIVACY_EVENT, callback)
  }
}

export function useBrokerPrivacy() {
  const privacyMode = useSyncExternalStore(subscribePrivacy, privacySnapshot, () => false)

  const togglePrivacyMode = useCallback(() => {
    const next = !privacySnapshot()
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, next ? '1' : '0')
    window.dispatchEvent(new Event(PRIVACY_EVENT))
  }, [])

  return { privacyMode, togglePrivacyMode }
}

export function BrokerPrivacyToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  const Icon = active ? EyeOff : Eye
  return (
    <button
      className={styles.iconButton}
      type="button"
      title={active ? 'Mostrar datos sensibles' : 'Ocultar datos sensibles para video'}
      aria-pressed={active}
      aria-label={active ? 'Mostrar datos sensibles' : 'Ocultar datos sensibles'}
      onClick={onToggle}
    >
      <Icon size={17} />
    </button>
  )
}

export function BrokerSensitiveValue({
  hidden,
  children,
  fallback = '••••••',
}: {
  hidden: boolean
  children: ReactNode
  fallback?: ReactNode
}) {
  if (!hidden) return <>{children}</>
  return <span className={styles.redactedValue}>{fallback}</span>
}

export function redactText(hidden: boolean, value: string | null | undefined, fallback = 'Dato oculto') {
  if (hidden) return fallback
  return value || '—'
}

export function redactShortId(hidden: boolean, value: string | null | undefined) {
  if (!value) return '—'
  if (hidden) return 'ID oculto'
  return value
}
