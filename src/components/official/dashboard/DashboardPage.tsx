'use client'

import Link from 'next/link'
import { useMemo, useSyncExternalStore } from 'react'
import productsData from '@/data/official/gumroad-products.json'
import s from './dashboard.module.css'

const ORDERS_KEY = 'gonovi:checkout:orders:v1'

type Product = {
  category: string
  description: string
  id: string
  key_features: string[]
  name: string
  price: string
}

type CheckoutOrder = {
  createdAt?: string
  email?: string
  id?: string
  name?: string
  productId?: string
  productName?: string
  status?: string
}

type OwnedScript = {
  description: string
  fileContent: string
  fileName: string
  id: string
  name: string
  purchasedAt: string
  version: string
}

const fallbackScript: OwnedScript = {
  id: 'ia-algotrend-pro',
  name: 'IA AlgoTrend PRO',
  version: 'Pine Script v6',
  purchasedAt: 'Biblioteca de muestra',
  description:
    'Script completo de IA AlgoTrend PRO. Cuando el checkout registre compras, este panel mostrará tus productos reales automáticamente.',
  fileName: 'IA-AlgoTrend-PRO.txt',
  fileContent: `// IA AlgoTrend PRO
// Archivo de muestra para validar el flujo de descarga.
// El dashboard reemplaza este contenido por el Pine Script comprado cuando exista una orden real.

//@version=6
indicator("IA AlgoTrend PRO", overlay=true)
plot(close, title="GONOVI Demo")
`,
}

function makeDownloadHref(content: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
}

function safeFileName(name: string) {
  return `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'gonovi-script'}.txt`
}

function scriptTemplate(product: Product, order?: CheckoutOrder) {
  return `// ${product.name}
// GONOVI AlgoTrend
// Producto: ${product.id}
// Orden: ${order?.id ?? 'sin-orden'}
// Email: ${order?.email ?? 'no-registrado'}
//
// Este archivo representa el paquete descargable del script comprado.
// En producción se adjunta aquí el Pine Script completo real.

//@version=6
indicator("${product.name}", overlay=true)
plot(close, title="GONOVI ${product.id}")
`
}

function formatDate(value?: string) {
  if (!value) return 'Compra registrada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Compra registrada'
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function readOrders() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(ORDERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((order): order is CheckoutOrder => Boolean(order && typeof order === 'object'))
  } catch {
    return []
  }
}

function getOrdersSnapshot() {
  return JSON.stringify(readOrders())
}

function getServerOrdersSnapshot() {
  return '[]'
}

function subscribeToOrders(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
  }
}

export function DashboardPage() {
  const ordersSnapshot = useSyncExternalStore(subscribeToOrders, getOrdersSnapshot, getServerOrdersSnapshot)
  const products = productsData as Product[]
  const orders = useMemo(() => JSON.parse(ordersSnapshot) as CheckoutOrder[], [ordersSnapshot])

  const ownedScripts = useMemo<OwnedScript[]>(() => {
    const mapped = orders
      .map((order) => {
        const product = products.find((item) => item.id === order.productId)
        if (!product) return null
        return {
          description: product.description,
          fileContent: scriptTemplate(product, order),
          fileName: safeFileName(product.name),
          id: `${order.id ?? product.id}-${product.id}`,
          name: product.name,
          purchasedAt: `${formatDate(order.createdAt)} · ${order.status === 'simulated_success' ? 'Pago simulado OK' : 'Orden registrada'}`,
          version: product.category,
        }
      })
      .filter((item): item is OwnedScript => item !== null)

    return mapped.length > 0 ? mapped : [fallbackScript]
  }, [orders, products])

  return (
    <main className={s.shell}>
      <div className={s.noise} />

      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← GONOVI</Link>
        <div>
          <span className={s.kicker}>Panel del cliente</span>
          <h1>Mis scripts</h1>
          <p>
            Biblioteca personal para volver a descargar tus Pine Scripts completos y acceder a las instrucciones de instalación.
          </p>
        </div>
        <Link href="/official/store" className={s.storeLink}>Ver tienda</Link>
      </header>

      <section className={s.summaryGrid} aria-label="Resumen de cuenta">
        <article>
          <span>Scripts comprados</span>
          <strong>{ownedScripts.length}</strong>
        </article>
        <article>
          <span>Estado</span>
          <strong>{orders.length > 0 ? 'Activo' : 'Demo'}</strong>
        </article>
        <article>
          <span>Entrega</span>
          <strong>Descarga .txt</strong>
        </article>
      </section>

      <section className={s.library}>
        <div className={s.sectionIntro}>
          <span className={s.kicker}>Biblioteca</span>
          <h2>Productos disponibles</h2>
        </div>

        {ownedScripts.map((script) => (
          <article className={s.scriptCard} key={script.id}>
            <div className={s.scriptMain}>
              <span className={s.scriptBadge}>{script.version}</span>
              <h3>{script.name}</h3>
              <p>{script.description}</p>
              <small>{script.purchasedAt}</small>
            </div>

            <div className={s.scriptActions}>
              <a
                className={s.primaryAction}
                download={script.fileName}
                href={makeDownloadHref(script.fileContent)}
              >
                Descargar .txt
              </a>
              <Link className={s.secondaryAction} href="/official/docs">
                Instrucciones de instalación
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
