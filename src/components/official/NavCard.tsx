import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './NavCard.module.css'

interface NavCardProps {
  href: string
  title: string
  subtitle: string
  icon?: ReactNode
}

export function NavCard({ href, title, subtitle, icon }: NavCardProps) {
  return (
    <Link href={href} className={styles.card}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>
    </Link>
  )
}
