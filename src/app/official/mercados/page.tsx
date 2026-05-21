import { notFound } from 'next/navigation'
import { MercadosPage } from '@/components/official/mercados/MercadosPage'

export const metadata = {
  title: 'Mercados | GONOVI',
  description: 'El ecosistema GONOVI cubre BTC y Oro en distintos timeframes.',
}

export const dynamic = 'force-dynamic'

export default function Page() {
  if (process.env.OFFICIAL_ENABLED !== 'true') {
    notFound()
  }
  return <MercadosPage />
}
