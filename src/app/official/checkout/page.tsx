import type { Metadata } from 'next'
import CheckoutPage from '@/components/official/checkout/CheckoutPage'

export const metadata: Metadata = {
  title: 'Script Completo GONOVI | Checkout',
  description: 'Compra el Pine Script completo de GONOVI con entrega por email, producto y metodo de pago.',
}

export default function CheckoutRoute() {
  return <CheckoutPage />
}
