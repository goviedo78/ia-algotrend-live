import type { Metadata } from 'next'
import { DocsPage } from '@/components/official/docs/DocsPage'

export const metadata: Metadata = {
  title: 'Documentación Pine Script | GONOVI',
  description: 'Guía rápida para cargar, guardar y ejecutar scripts Pine Script de GONOVI en TradingView.',
}

export default function OfficialDocsRoute() {
  return <DocsPage />
}
