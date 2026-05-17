import Link from 'next/link'
import styles from './store.module.css'
import productsData from '@/data/official/gumroad-products.json'

type Product = {
  id: string
  name: string
  description: string
  key_features: string[]
  price: string
  link: string
  category: string
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function StorePage() {
  const products = productsData as Product[]

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.kickerWrapper}>
          <span className={styles.kickerDot} aria-hidden="true" />
          <p className={styles.kicker}>Catálogo de Indicadores</p>
        </div>
        <h1 className={styles.title}>La Tienda GONOVI</h1>
        <p className={styles.description}>
          Scripts completos de Pine Script para TradingView. Un pago único te entrega el código fuente
          por email para conservarlo para siempre, sin suscripción ni acceso revocable.
        </p>
      </header>

      <div className={styles.grid}>
        {products.map((product) => (
          <article key={product.id} className={styles.card}>
            <div className={styles.cardGlow} aria-hidden="true" />
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <span className={styles.category}>{product.category}</span>
                <h2 className={styles.cardTitle}>{product.name}</h2>
                <p className={styles.cardDesc}>{product.description}</p>
              </div>
              
              <ul className={styles.features}>
                {product.key_features.map((feature, idx) => (
                  <li key={idx}>
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className={styles.cardFooter}>
                <span className={styles.price}>{product.price}</span>
                <Link href={product.link} className={styles.buyBtn}>
                  Adquirir Script
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
