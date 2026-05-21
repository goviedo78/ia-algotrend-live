'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import gumroadProducts from '@/data/official/gumroad-products.json'
import s from './checkout.module.css'
import OrderConfirmModal from './OrderConfirmModal'

type PaymentMethod = 'gumroad' | 'manual' | 'usdt'
type StablecoinNetwork = 'trc20' | 'erc20' | 'polygon'

type Product = {
  category: string
  description: string
  demo: string
  id: string
  keyFeatures: string[]
  name: string
  price: number
}

function parsePrice(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 12.99
}

const products: Product[] = gumroadProducts.map((product) => ({
  category: product.category,
  demo: product.link,
  description: product.description,
  id: product.id,
  keyFeatures: product.key_features,
  name: product.name,
  price: parsePrice(product.price),
}))

const stablecoinNetworks: Record<StablecoinNetwork, { label: string; asset: string; fee: string }> = {
  erc20: {
    asset: 'USDC / USDT',
    fee: 'Alta',
    label: 'Ethereum ERC20',
  },
  polygon: {
    asset: 'USDC',
    fee: 'Baja',
    label: 'Polygon',
  },
  trc20: {
    asset: 'USDT',
    fee: 'Media',
    label: 'Tron TRC20',
  },
}

function getInitialProduct() {
  if (typeof window === 'undefined') return products[0].id
  const requested = new URLSearchParams(window.location.search).get('product')
  return products.some((product) => product.id === requested) ? requested! : products[0].id
}

function makeOrderId() {
  return `GNV-${Date.now().toString(36).toUpperCase()}`
}

function paymentLabel(method: PaymentMethod, network: StablecoinNetwork) {
  if (method === 'gumroad') return 'Tarjeta / Gumroad'
  if (method === 'manual') return 'Soporte directo'
  return stablecoinNetworks[network].asset
}

export default function CheckoutPage() {
  const [productId, setProductId] = useState(getInitialProduct)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tradingView, setTradingView] = useState('')
  const [telegram, setTelegram] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('gumroad')
  const [network, setNetwork] = useState<StablecoinNetwork>('polygon')
  const [accepted, setAccepted] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const product = useMemo(() => products.find((item) => item.id === productId) ?? products[0], [productId])
  const canSubmit = name.trim().length >= 2 && email.includes('@') && accepted && !processing

  async function submitOrder() {
    if (!canSubmit) return

    setProcessing(true)

    await new Promise((resolve) => window.setTimeout(resolve, 2000))

    const id = makeOrderId()
    const order = {
      id,
      createdAt: new Date().toISOString(),
      email,
      method,
      name: name.trim(),
      network: method === 'usdt' ? network : null,
      productId,
      productName: product.name,
      telegram,
      tradingView,
      status: 'simulated_success',
    }

    const key = 'gonovi:checkout:orders:v1'
    const current = window.localStorage.getItem(key)
    const orders = current ? JSON.parse(current) as unknown[] : []
    window.localStorage.setItem(key, JSON.stringify([order, ...orders].slice(0, 12)))
    setOrderId(id)
    setProcessing(false)
    setShowModal(true)
  }

  return (
    <main className={s.shell}>
      <div className={s.noise} />
      <header className={s.header}>
        <Link href="/official" className={s.backLink}>← GONOVI</Link>
        <div>
          <span>SCRIPT COMPLETO GONOVI</span>
          <p>Pine Script completo · entrega por email · pago seguro</p>
        </div>
        <Link href="/official" className={s.headerAction}>Ver tienda</Link>
      </header>

      <section className={s.hero}>
        <div>
          <p className={s.kicker}>Descarga del script</p>
          <h1>Compra simple, codigo completo.</h1>
          <p>
            Elegi el indicador, deja tu email y confirma el metodo de pago.
            Recibiras el script completo de Pine Script por email para conservarlo para siempre.
          </p>
        </div>
        <aside>
          <span>Producto seleccionado</span>
          <strong>{product.name}</strong>
          <p>{product.category} · ${product.price.toFixed(2)} USD</p>
          <ul className={s.valueList}>
            <li>Script completo — tuyo para siempre, sin suscripcion ni acceso revocable.</li>
            <li>Entrega por email con instrucciones para pegarlo en TradingView.</li>
            <li>Pago unico, sin suscripcion mensual.</li>
          </ul>
        </aside>
      </section>

      <section className={s.checkoutGrid}>
        <form className={s.form} onSubmit={(event) => { event.preventDefault(); submitOrder() }}>
          <label>
            <span>Producto</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · ${item.price.toFixed(2)}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Nombre</span>
            <input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" required />
          </label>

          <label>
            <span>Email</span>
            <input type="email" maxLength={150} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required />
          </label>

          <label>
            <span>Usuario TradingView opcional</span>
            <input value={tradingView} maxLength={50} onChange={(event) => setTradingView(event.target.value)} placeholder="referencia opcional" />
          </label>

          <label>
            <span>Telegram / WhatsApp opcional</span>
            <input value={telegram} maxLength={50} onChange={(event) => setTelegram(event.target.value)} placeholder="@usuario o numero" />
          </label>

          <div className={s.payments}>
            <button type="button" className={method === 'gumroad' ? s.active : ''} onClick={() => setMethod('gumroad')}>Tarjeta / Gumroad</button>
            <button type="button" className={method === 'manual' ? s.active : ''} onClick={() => setMethod('manual')}>Soporte directo</button>
            <button type="button" className={method === 'usdt' ? s.active : ''} onClick={() => setMethod('usdt')}>USDT / USDC</button>
          </div>

          {method === 'usdt' && (
            <div className={s.cryptoBox}>
              <label>
                <span>Red stablecoin</span>
                <select value={network} onChange={(event) => setNetwork(event.target.value as StablecoinNetwork)}>
                  {Object.entries(stablecoinNetworks).map(([id, item]) => (
                    <option key={id} value={id}>{item.label} · {item.asset} · comisión {item.fee}</option>
                  ))}
                </select>
              </label>
              <div className={s.walletCard}>
                <span>Direccion de pago</span>
                <strong>La dirección de pago se genera al confirmar tu orden.</strong>
                <small>Importe estimado: ${product.price.toFixed(2)} en {stablecoinNetworks[network].asset}. Te enviaremos la direccion y la referencia exacta para evitar errores de red.</small>
              </div>
            </div>
          )}

          <label className={s.check}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Entiendo que recibire el script completo de Pine Script por email despues de confirmar el pago.</span>
          </label>

          <button className={s.primary} type="submit" disabled={!canSubmit}>
            {processing ? 'Procesando pago...' : 'Confirmar Pago'}
          </button>
        </form>

        <aside className={s.summary}>
          <p className={s.kicker}>Resumen</p>
          <h2>{product.name}</h2>
          <p className={s.productDescription}>{product.description}</p>
          <div className={s.featureBox}>
            <span>Incluye</span>
            <ul>
              {product.keyFeatures.slice(0, 5).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className={s.line}><span>Entrega</span><strong>Script completo</strong></div>
          <div className={s.line}><span>Precio</span><strong>${product.price.toFixed(2)} USD</strong></div>
          <div className={s.line}><span>Metodo</span><strong>{paymentLabel(method, network)}</strong></div>
          {method === 'usdt' && (
            <div className={s.line}><span>Red</span><strong>{stablecoinNetworks[network].label}</strong></div>
          )}
          <div className={s.line}><span>Propiedad</span><strong>Para siempre</strong></div>
          <div className={s.paymentHint}>
            <span>Como sigue</span>
            <ol>
              <li>Confirmas la compra.</li>
              <li>Completas el pago elegido.</li>
              <li>Recibis el Pine Script completo por email.</li>
            </ol>
          </div>

          {orderId
            ? <p className={s.note}>Referencia: <code>{orderId}</code></p>
            : <p className={s.note}>Completa nombre, email y acepta las condiciones para probar el funnel de compra.</p>
          }
        </aside>
      </section>

      {showModal && (
        <OrderConfirmModal
          email={email}
          productName={product.name}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  )
}
