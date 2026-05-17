import type { Metadata } from 'next'
import BacktestingPage from '@/components/official/backtesting/BacktestingPage'

export const metadata: Metadata = {
  title: 'Backtesting Libre 5M | GONOVI',
  description: 'Practica backtesting manual vela a vela en escenarios de 5 minutos.',
}

export default function BacktestingRoute() {
  return <BacktestingPage />
}
