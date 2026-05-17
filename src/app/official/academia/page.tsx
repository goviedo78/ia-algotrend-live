import type { Metadata } from 'next'
import AcademiaPage from '@/components/official/academia/AcademiaPage'

export const metadata: Metadata = {
  title: 'Trading Interactivo | GONOVI',
  description: 'Retos graficos y entrenamiento visual para aprender lectura de mercado con feedback inmediato.',
}

export default function AcademiaRoute() {
  return <AcademiaPage />
}
