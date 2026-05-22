'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './account.module.css'

interface User {
  id: string
  email: string
}

interface AccountPanelProps {
  user: User
  supportTicketsCount: number
}

export function AccountPanel({ user, supportTicketsCount }: AccountPanelProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/')
    } catch (err) {
      console.error('Error logging out', err)
      // fallback
      router.replace('/')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.avatar}>
          {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className={styles.userInfo}>
          <h1 className={styles.email}>{user.email}</h1>
          <p className={styles.memberSince}>Miembro desde 2026</p>
        </div>
      </header>

      <div className={styles.grid}>
        <Link href="/official/store" className={styles.card}>
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Mis compras</h2>
            <p className={styles.cardDesc}>Sin compras todavía.</p>
            <span className={styles.cta}>Ir a la Tienda →</span>
          </div>
        </Link>

        <Link href="/official/lab" className={styles.card}>
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Mi progreso</h2>
            <p className={styles.cardDesc}>Estadísticas y XP.</p>
            <span className={styles.cta}>Empezá en Trading Lab →</span>
          </div>
        </Link>

        <Link href="/official/mercados" className={styles.card}>
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Mis alertas</h2>
            <p className={styles.cardDesc}>Configurá alertas para BTC y Oro.</p>
            <span className={styles.cta}>Ver mercados →</span>
          </div>
        </Link>

        <Link href="/official/soporte" className={styles.card}>
          <div className={styles.cardGlow} aria-hidden="true" />
          <div className={styles.cardContent}>
            <h2 className={styles.cardTitle}>Mi soporte</h2>
            <p className={styles.cardDesc}>
              {supportTicketsCount === 0
                ? 'Sin tickets abiertos.'
                : supportTicketsCount === 1
                  ? '1 ticket abierto'
                  : `${supportTicketsCount} tickets abiertos`}
            </p>
            <span className={styles.cta}>Abrir soporte →</span>
          </div>
        </Link>
      </div>

      <button onClick={handleLogout} className={styles.logoutBtn}>
        Cerrar sesión
      </button>
    </div>
  )
}
