import type { Metadata } from 'next'
import { DashboardPage } from '@/components/official/dashboard/DashboardPage'

export const metadata: Metadata = {
  title: 'Dashboard Cliente | GONOVI AlgoTrend',
  description: 'Panel del cliente para descargar scripts Pine Script comprados en GONOVI.',
  robots: { index: false, follow: false },
}

export default function OfficialDashboardRoute() {
  return <DashboardPage />
}
