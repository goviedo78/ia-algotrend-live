import type { Metadata } from 'next'
import { DashboardPage } from '@/components/official/dashboard/DashboardPage'

export const metadata: Metadata = {
  metadataBase: new URL('https://gonovi.app'),
  title: 'Dashboard Cliente | GONOVI',
  description: 'Panel privado del cliente GONOVI. Descarga y gestiona tus scripts Pine Script adquiridos.',
  robots: { index: false, follow: false },
}

export default function OfficialDashboardRoute() {
  return <DashboardPage />
}
