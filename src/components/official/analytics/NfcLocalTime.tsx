'use client'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function NfcLocalTime({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)

  if (!isClient) {
    const fallback = iso.replace('T', ' ').substring(0, 16) + ' UTC'
    return <span title={`UTC original: ${iso}`}>{fallback}</span>
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

  return <span title={`UTC original: ${iso}`}>{formatted}</span>
}
