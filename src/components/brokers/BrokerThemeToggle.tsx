'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import styles from './brokers.module.css'

export type BrokerTheme = 'light' | 'dark'

const STORAGE_KEY = 'gonovi-broker-theme'
const THEME_EVENT = 'gonovi-broker-theme-change'

function getThemeSnapshot(): BrokerTheme {
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(THEME_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(THEME_EVENT, onStoreChange)
  }
}

export function useBrokerTheme() {
  const theme = useSyncExternalStore<BrokerTheme>(subscribeToTheme, getThemeSnapshot, () => 'dark')

  function toggleTheme() {
    const nextTheme: BrokerTheme = theme === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { theme, toggleTheme }
}

export function BrokerThemeToggle({ theme, onToggle }: { theme: BrokerTheme; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'

  return (
    <button
      className={styles.themeToggle}
      type="button"
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
      onClick={onToggle}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
